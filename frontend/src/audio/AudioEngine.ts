import {
  FFT_SIZE,
  FX_DEFAULTS,
  SMOOTHING,
  type FXFilterMode,
  type FXState,
} from '../utils/constants';

export interface MeterValues {
  rmsDb: number;
  peakDb: number;
  lufs: number;
  gainReduction: number;
  stereoWidth: number;
}

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

type AudioContextWithSinkId = AudioContext & {
  setSinkId?: (sinkId: string | { type: 'none' }) => Promise<void>;
  sinkId?: string;
};

type HTMLAudioElementWithSinkId = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
  sinkId?: string;
};

type MediaDevicesWithOutputSelection = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private outputElement: HTMLAudioElementWithSinkId | null = null;
  private outputDestination: MediaStreamAudioDestinationNode | null = null;
  private currentBlobUrl: string | null = null;
  private outputDeviceId = 'default';
  private outputRouteMode: 'context' | 'media-element' = 'context';
  private sweepAmount = FX_DEFAULTS.sweep;

  // DSP nodes
  private inputGain: GainNode | null = null;
  private noiseGate: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private exciterWet: WaveShaperNode | null = null;
  private exciterDry: GainNode | null = null;
  private exciterMix: GainNode | null = null;
  private widenerMid: GainNode | null = null;
  private widenerSide: GainNode | null = null;
  private bassBoostNode: BiquadFilterNode | null = null;
  private sweepFilter: BiquadFilterNode | null = null;
  private driveWet: WaveShaperNode | null = null;
  private driveDry: GainNode | null = null;
  private driveMix: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private echoDryGain: GainNode | null = null;
  private echoWetGain: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private reverbToneFilter: BiquadFilterNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private autoPanOsc: OscillatorNode | null = null;
  private autoPanGain: GainNode | null = null;
  private manualPanAmount = 0;
  private autoPanDepthAmount = 0;
  private masterGain: GainNode | null = null;

  // Meter state
  private _meters: MeterValues = { rmsDb: -60, peakDb: -60, lufs: -70, gainReduction: 0, stereoWidth: 0 };

  get context(): AudioContext | null { return this.ctx; }
  get analyserNode(): AnalyserNode | null { return this.analyser; }
  get audio(): HTMLAudioElement | null { return this.audioElement; }
  get isInitialized(): boolean { return this.ctx !== null && this.ctx.state !== 'closed'; }
  get meters(): MeterValues { return this._meters; }
  get currentOutputDeviceId(): string { return this.outputDeviceId; }
  get outputRoute(): 'context' | 'media-element' { return this.outputRouteMode; }
  get supportsOutputDeviceSelection(): boolean {
    return this.supportsAudioContextSink() || this.supportsMediaElementSink();
  }
  get supportsOutputDevicePrompt(): boolean {
    const mediaDevices = this.getMediaDevices();
    return typeof mediaDevices?.selectAudioOutput === 'function';
  }

  async init(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'closed') return;

    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';

    // Input Gain
    this.inputGain = this.ctx.createGain();
    this.inputGain.gain.value = 1;

    // Noise Gate (gain node controlled via ScriptProcessor or manual gating)
    this.noiseGate = this.ctx.createGain();
    this.noiseGate.gain.value = 1; // 1 = open, 0 = gated

    // EQ filters (10 bands)
    this.eqFilters = this.createEQChain();

    // Compressor
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.2;
    this.compressor.knee.value = 10;

    // Limiter (ultra-fast compressor)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;
    this.limiter.knee.value = 0;

    // Harmonic Exciter (waveshaper)
    this.exciterDry = this.ctx.createGain();
    this.exciterDry.gain.value = 1;
    this.exciterWet = this.ctx.createWaveShaper();
    this.exciterWet.curve = this.generateExciterCurve(0) as Float32Array<ArrayBuffer>;
    this.exciterWet.oversample = '4x';
    this.exciterMix = this.ctx.createGain();
    this.exciterMix.gain.value = 0;

    // Stereo Widener (Mid/Side)
    this.widenerMid = this.ctx.createGain();
    this.widenerMid.gain.value = 1;
    this.widenerSide = this.ctx.createGain();
    this.widenerSide.gain.value = 1;

    // Bass boost (focused lowshelf instead of broadband gain)
    this.bassBoostNode = this.ctx.createBiquadFilter();
    this.bassBoostNode.type = 'lowshelf';
    this.bassBoostNode.frequency.value = 95;
    this.bassBoostNode.gain.value = 0;

    // Sweep filter (LP/HP/Notch)
    this.sweepFilter = this.ctx.createBiquadFilter();
    this.sweepFilter.type = 'lowpass';
    this.sweepFilter.frequency.value = 20000;
    this.sweepFilter.Q.value = FX_DEFAULTS.filterResonance;

    // Drive / saturation (parallel dry/wet)
    this.driveDry = this.ctx.createGain();
    this.driveDry.gain.value = 1;
    this.driveWet = this.ctx.createWaveShaper();
    this.driveWet.curve = this.generateDriveCurve(0) as Float32Array<ArrayBuffer>;
    this.driveWet.oversample = '4x';
    this.driveMix = this.ctx.createGain();
    this.driveMix.gain.value = 0;

    // Echo / Delay
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = this.mapEchoTime(FX_DEFAULTS.echoTime);
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = this.mapEchoFeedback(FX_DEFAULTS.echoFeedback);
    this.echoDryGain = this.ctx.createGain();
    this.echoDryGain.gain.value = 1;
    this.echoWetGain = this.ctx.createGain();
    this.echoWetGain.gain.value = 0;

    // Reverb (convolver)
    this.convolverNode = this.ctx.createConvolver();
    this.reverbToneFilter = this.ctx.createBiquadFilter();
    this.reverbToneFilter.type = 'lowpass';
    this.reverbToneFilter.frequency.value = this.mapReverbTone(FX_DEFAULTS.reverbTone);
    this.reverbToneFilter.Q.value = 0.7;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1;
    const impulseBuffer = this.generateImpulseResponse(2, 2, true);
    this.convolverNode.buffer = impulseBuffer;

    // Panner
    this.pannerNode = this.ctx.createStereoPanner();
    this.pannerNode.pan.value = 0;
    this.autoPanOsc = this.ctx.createOscillator();
    this.autoPanOsc.type = 'sine';
    this.autoPanOsc.frequency.value = FX_DEFAULTS.autoPanRate;
    this.autoPanGain = this.ctx.createGain();
    this.autoPanGain.gain.value = 0;
    this.autoPanOsc.connect(this.autoPanGain);
    this.autoPanGain.connect(this.pannerNode.pan);
    this.autoPanOsc.start();

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    // Analyser (main)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = SMOOTHING;

    // Stereo analysers for width meter
    this.analyserL = this.ctx.createAnalyser();
    this.analyserL.fftSize = 1024;
    this.analyserL.smoothingTimeConstant = 0.8;
    this.analyserR = this.ctx.createAnalyser();
    this.analyserR.fftSize = 1024;
    this.analyserR.smoothingTimeConstant = 0.8;

    // Splitter for stereo width meter
    this.splitter = this.ctx.createChannelSplitter(2);

    // Create source once
    this.source = this.ctx.createMediaElementSource(this.audioElement);

    // Connect pipeline
    this.connectPipeline();

    if (this.outputDeviceId !== 'default') {
      await this.setOutputDevice(this.outputDeviceId);
    }
  }

  async loadAudio(src: string): Promise<void> {
    if (!this.ctx || !this.audioElement) await this.init();
    if (this.ctx!.state === 'suspended') await this.ctx!.resume();

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    this.audioElement!.pause();
    this.audioElement!.removeAttribute('src');
    this.audioElement!.load();

    const isSameOrigin = src.startsWith('/') || src.startsWith(window.location.origin);
    const isBlob = src.startsWith('blob:');
    const isTauriAsset =
      src.startsWith('asset:') ||
      src.startsWith('http://asset.localhost') ||
      src.startsWith('https://asset.localhost');

    if (isSameOrigin || isBlob) {
      this.audioElement!.src = src;
      return this.waitForCanPlay();
    }

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      const blob = await response.blob();
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.audioElement!.src = this.currentBlobUrl;
      return this.waitForCanPlay();
    } catch (err) {
      console.error('AudioEngine load error:', err);
      if (isTauriAsset) {
        throw new Error(
          'Failed to load Tauri asset into the Web Audio pipeline. Check asset protocol access and media codecs.',
        );
      }
      this.audioElement!.src = src;
      return this.waitForCanPlay();
    }
  }

  private waitForCanPlay(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onCanPlay = () => {
        this.audioElement!.removeEventListener('canplay', onCanPlay);
        this.audioElement!.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        this.audioElement!.removeEventListener('canplay', onCanPlay);
        this.audioElement!.removeEventListener('error', onError);
        reject(new Error(this.audioElement!.error?.message || 'Unknown audio error'));
      };
      this.audioElement!.addEventListener('canplay', onCanPlay);
      this.audioElement!.addEventListener('error', onError);
      this.audioElement!.load();
    });
  }

  private createEQChain(): BiquadFilterNode[] {
    const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const filters: BiquadFilterNode[] = [];
    for (let i = 0; i < frequencies.length; i++) {
      const filter = this.ctx!.createBiquadFilter();
      if (i === 0) filter.type = 'lowshelf';
      else if (i === frequencies.length - 1) filter.type = 'highshelf';
      else filter.type = 'peaking';
      filter.frequency.value = frequencies[i];
      filter.gain.value = 0;
      filter.Q.value = 1.4;
      filters.push(filter);
    }
    return filters;
  }

  private generateExciterCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    if (amount === 0) {
      // Linear pass-through
      for (let i = 0; i < samples; i++) curve[i] = (i * 2) / samples - 1;
      return curve;
    }
    const k = amount * 50; // 0-50 range
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft-clip waveshaper with harmonic generation
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  private generateDriveCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    if (amount <= 0) {
      for (let i = 0; i < samples; i++) curve[i] = (i * 2) / samples - 1;
      return curve;
    }

    const drive = 1 + amount * 90;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    return curve;
  }

  private mapEchoTime(value: number): number {
    const min = 0.06;
    const max = 1.0;
    return min + (Math.max(0, Math.min(100, value)) / 100) * (max - min);
  }

  private mapEchoFeedback(value: number): number {
    return (Math.max(0, Math.min(100, value)) / 100) * 0.75;
  }

  private mapReverbTone(value: number): number {
    const min = 1200;
    const max = 20000;
    const normalized = Math.max(0, Math.min(100, value)) / 100;
    return min * Math.pow(max / min, normalized);
  }

  private generateImpulseResponse(duration: number, decay: number, reverse: boolean): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const n = reverse ? length - i : i;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      }
    }
    return impulse;
  }

  private connectPipeline(): void {
    if (!this.source || !this.ctx || !this.analyser) return;

    // Pipeline: Source → InputGain → NoiseGate → EQ → Compressor → Limiter
    //         → Exciter(dry/wet) → StereoWidener(Mid/Side) → BassBoost → Sweep
    //         → Drive → Echo → Reverb → Pan/AutoPan → Analyser → Splitter(analyserL/R)
    //         → Master → Destination

    let chain: AudioNode = this.source;

    // Input Gain
    chain.connect(this.inputGain!);
    chain = this.inputGain!;

    // Noise Gate
    chain.connect(this.noiseGate!);
    chain = this.noiseGate!;

    // EQ chain
    for (const filter of this.eqFilters) {
      chain.connect(filter);
      chain = filter;
    }

    // Compressor
    chain.connect(this.compressor!);
    chain = this.compressor!;

    // Limiter
    chain.connect(this.limiter!);
    chain = this.limiter!;

    // Harmonic Exciter (parallel dry/wet)
    chain.connect(this.exciterDry!);
    chain.connect(this.exciterWet!);
    this.exciterWet!.connect(this.exciterMix!);
    const exciterMerge = this.ctx.createGain();
    exciterMerge.gain.value = 1;
    this.exciterDry!.connect(exciterMerge);
    this.exciterMix!.connect(exciterMerge);
    chain = exciterMerge;

    // Stereo Widener (Mid/Side processing)
    // Encode: Mid = (L+R)/2, Side = (L-R)/2
    // Decode: L = Mid+Side, R = Mid-Side
    // Widening = boost Side gain
    const midEncode = this.ctx.createGain();
    midEncode.gain.value = 0.5;
    const sideEncode = this.ctx.createGain();
    sideEncode.gain.value = 0.5;

    const widenerSplitter = this.ctx.createChannelSplitter(2);
    const widenerMerger = this.ctx.createChannelMerger(2);

    chain.connect(widenerSplitter);

    // Mid path: L+R
    widenerSplitter.connect(midEncode, 0);
    widenerSplitter.connect(midEncode, 1);
    midEncode.connect(this.widenerMid!);
    this.widenerMid!.connect(widenerMerger, 0, 0);
    this.widenerMid!.connect(widenerMerger, 0, 1);

    // Side path: L-R
    const sideInvert = this.ctx.createGain();
    sideInvert.gain.value = -1;
    widenerSplitter.connect(sideEncode, 0);
    widenerSplitter.connect(sideInvert, 1);
    sideInvert.connect(sideEncode);
    sideEncode.connect(this.widenerSide!);
    this.widenerSide!.connect(widenerMerger, 0, 0);
    const sideNeg = this.ctx.createGain();
    sideNeg.gain.value = -1;
    this.widenerSide!.connect(sideNeg);
    sideNeg.connect(widenerMerger, 0, 1);

    chain = widenerMerger;

    // Bass boost
    chain.connect(this.bassBoostNode!);
    chain = this.bassBoostNode!;

    // Sweep filter
    chain.connect(this.sweepFilter!);
    chain = this.sweepFilter!;

    // Drive - parallel wet/dry saturation
    chain.connect(this.driveDry!);
    chain.connect(this.driveWet!);
    this.driveWet!.connect(this.driveMix!);
    const driveMerge = this.ctx.createGain();
    driveMerge.gain.value = 1;
    this.driveDry!.connect(driveMerge);
    this.driveMix!.connect(driveMerge);
    chain = driveMerge;

    // Delay (echo) - parallel wet/dry
    const echoMerge = this.ctx.createGain();
    echoMerge.gain.value = 1;
    chain.connect(this.echoDryGain!);
    this.echoDryGain!.connect(echoMerge);
    chain.connect(this.delayNode!);
    this.delayNode!.connect(this.delayFeedback!);
    this.delayFeedback!.connect(this.delayNode!);
    this.delayNode!.connect(this.echoWetGain!);
    this.echoWetGain!.connect(echoMerge);
    chain = echoMerge;

    // Reverb - parallel wet/dry
    chain.connect(this.dryGain!);
    chain.connect(this.convolverNode!);
    this.convolverNode!.connect(this.reverbToneFilter!);
    this.reverbToneFilter!.connect(this.reverbGain!);
    const reverbMerge = this.ctx.createGain();
    reverbMerge.gain.value = 1;
    this.dryGain!.connect(reverbMerge);
    this.reverbGain!.connect(reverbMerge);
    chain = reverbMerge;

    // Panner
    chain.connect(this.pannerNode!);
    chain = this.pannerNode!;

    // Analyser (main)
    chain.connect(this.analyser);
    chain = this.analyser;

    // Stereo splitter for width meter
    chain.connect(this.splitter!);
    this.splitter!.connect(this.analyserL!, 0);
    this.splitter!.connect(this.analyserR!, 1);

    // Master gain → destination
    chain.connect(this.masterGain!);
    this.connectMasterToContextDestination();
  }

  private getMediaDevices(): MediaDevicesWithOutputSelection | null {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return null;
    return navigator.mediaDevices as MediaDevicesWithOutputSelection;
  }

  private supportsAudioContextSink(): boolean {
    if (this.ctx && typeof (this.ctx as AudioContextWithSinkId).setSinkId === 'function') {
      return true;
    }
    if (typeof AudioContext === 'undefined') return false;
    return typeof (AudioContext.prototype as unknown as AudioContextWithSinkId).setSinkId === 'function';
  }

  private supportsMediaElementSink(): boolean {
    if (typeof HTMLMediaElement === 'undefined') return false;
    return typeof (HTMLMediaElement.prototype as unknown as HTMLAudioElementWithSinkId).setSinkId === 'function';
  }

  private disconnectMasterOutput(): void {
    try {
      this.masterGain?.disconnect();
    } catch {
      // Ignore disconnect errors from nodes without active output connections.
    }
  }

  private connectMasterToContextDestination(): void {
    if (!this.ctx || !this.masterGain) return;
    this.disconnectMasterOutput();
    this.outputElement?.pause();
    this.masterGain.connect(this.ctx.destination);
    this.outputRouteMode = 'context';
  }

  private async connectMasterToMediaElementSink(deviceId: string): Promise<void> {
    if (!this.ctx || !this.masterGain) return;

    if (!this.supportsMediaElementSink()) {
      throw new Error('Audio output device selection is not supported by this WebView.');
    }

    if (!this.outputDestination) {
      this.outputDestination = this.ctx.createMediaStreamDestination();
    }

    if (!this.outputElement) {
      this.outputElement = new Audio() as HTMLAudioElementWithSinkId;
      this.outputElement.autoplay = true;
      this.outputElement.crossOrigin = 'anonymous';
    }

    this.outputElement.srcObject = this.outputDestination.stream;
    await this.outputElement.setSinkId!(deviceId);

    this.disconnectMasterOutput();
    this.masterGain.connect(this.outputDestination);
    this.outputRouteMode = 'media-element';

    try {
      await this.outputElement.play();
    } catch (err) {
      console.warn('Deferred output stream playback until the next user play gesture:', err);
    }
  }

  private async resetAudioContextSink(): Promise<void> {
    if (!this.ctx) return;
    const ctxWithSink = this.ctx as AudioContextWithSinkId;
    if (typeof ctxWithSink.setSinkId !== 'function') return;

    try {
      await ctxWithSink.setSinkId('');
    } catch (err) {
      console.warn('Unable to reset AudioContext sink to default:', err);
    }
  }

  async getOutputDevices(): Promise<AudioOutputDevice[]> {
    const fallback: AudioOutputDevice = {
      deviceId: 'default',
      label: 'System Default',
      isDefault: true,
    };

    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices?.enumerateDevices) return [fallback];

    try {
      const devices = await mediaDevices.enumerateDevices();
      const outputs = devices.filter((device) => device.kind === 'audiooutput');
      const mapped = outputs.map((device, index) => {
        const deviceId = device.deviceId || 'default';
        const isDefault = deviceId === 'default' || deviceId === '';
        return {
          deviceId,
          label: device.label || (isDefault ? 'System Default' : `Output Device ${index + 1}`),
          isDefault,
        };
      });

      const unique = new Map<string, AudioOutputDevice>();
      unique.set(fallback.deviceId, fallback);
      for (const device of mapped) unique.set(device.deviceId, device);
      return Array.from(unique.values());
    } catch (err) {
      console.warn('Unable to enumerate audio output devices:', err);
      return [fallback];
    }
  }

  async promptForOutputDevice(): Promise<AudioOutputDevice | null> {
    const mediaDevices = this.getMediaDevices();
    if (typeof mediaDevices?.selectAudioOutput !== 'function') return null;

    const device = await mediaDevices.selectAudioOutput();
    const deviceId = device.deviceId || 'default';
    const isDefault = deviceId === 'default' || deviceId === '';
    return {
      deviceId,
      label: device.label || (isDefault ? 'System Default' : 'Selected Output Device'),
      isDefault,
    };
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const normalizedDeviceId = deviceId || 'default';
    const previousDeviceId = this.outputDeviceId;
    this.outputDeviceId = normalizedDeviceId;

    if (!this.ctx || this.ctx.state === 'closed' || !this.masterGain) {
      await this.init();
    }

    if (!this.ctx || !this.masterGain) return;

    try {
      if (normalizedDeviceId === 'default') {
        await this.resetAudioContextSink();
        this.connectMasterToContextDestination();
        return;
      }

      const ctxWithSink = this.ctx as AudioContextWithSinkId;
      if (typeof ctxWithSink.setSinkId === 'function') {
        try {
          await ctxWithSink.setSinkId(normalizedDeviceId);
          this.connectMasterToContextDestination();
          return;
        } catch (err) {
          console.warn('AudioContext sink selection failed, trying media-element output route:', err);
        }
      }

      await this.connectMasterToMediaElementSink(normalizedDeviceId);
    } catch (err) {
      this.outputDeviceId = previousDeviceId;
      throw err;
    }
  }

  // --- DSP Controls (all use 50ms ramp) ---

  setInputGain(value: number): void {
    // value 0-100 → gain 0-2
    const gain = value / 50;
    this.inputGain?.gain.linearRampToValueAtTime(gain, this.ctx!.currentTime + 0.05);
  }

  setNoiseGate(threshold: number): void {
    // threshold 0-100 → 0 = off (gate open), higher = more gating
    // We implement gating by checking analyser and closing gate when below threshold
    // This is a simplified approach: store threshold for use in updateMeters
    this._noiseGateThreshold = threshold;
  }

  private _noiseGateThreshold = 0;

  setEqBand(index: number, gainDb: number): void {
    if (this.eqFilters[index]) {
      this.eqFilters[index].gain.linearRampToValueAtTime(gainDb, this.ctx!.currentTime + 0.05);
    }
  }

  setCompressor(params: { threshold?: number; ratio?: number; attack?: number; release?: number }): void {
    const t = this.ctx!.currentTime + 0.05;
    if (params.threshold !== undefined) this.compressor?.threshold.linearRampToValueAtTime(params.threshold, t);
    if (params.ratio !== undefined) this.compressor?.ratio.linearRampToValueAtTime(params.ratio, t);
    if (params.attack !== undefined) this.compressor?.attack.linearRampToValueAtTime(params.attack, t);
    if (params.release !== undefined) this.compressor?.release.linearRampToValueAtTime(params.release, t);
  }

  setLimiterCeiling(ceilingDb: number): void {
    this.limiter?.threshold.linearRampToValueAtTime(ceilingDb, this.ctx!.currentTime + 0.05);
  }

  setExciter(amount: number): void {
    // amount 0-100 → mix 0-1
    const mix = amount / 100;
    this.exciterMix?.gain.linearRampToValueAtTime(mix, this.ctx!.currentTime + 0.05);
    this.exciterDry?.gain.linearRampToValueAtTime(1 - mix * 0.5, this.ctx!.currentTime + 0.05);
    if (this.exciterWet) {
      this.exciterWet.curve = this.generateExciterCurve(mix) as Float32Array<ArrayBuffer>;
    }
  }

  setStereoWidth(width: number): void {
    // width 0-100 → mid=1, side=0..2
    const sideGain = width / 50; // 0-2
    this.widenerMid?.gain.linearRampToValueAtTime(1, this.ctx!.currentTime + 0.05);
    this.widenerSide?.gain.linearRampToValueAtTime(sideGain, this.ctx!.currentTime + 0.05);
  }

  setBassBoost(value: number): void {
    const gainDb = (Math.max(0, Math.min(100, value)) / 100) * 12;
    this.bassBoostNode?.gain.linearRampToValueAtTime(gainDb, this.ctx!.currentTime + 0.05);
  }

  setReverb(value: number): void {
    const wet = value / 100;
    this.reverbGain?.gain.linearRampToValueAtTime(wet, this.ctx!.currentTime + 0.05);
    this.dryGain?.gain.linearRampToValueAtTime(1 - wet * 0.5, this.ctx!.currentTime + 0.05);
  }

  setEcho(value: number): void {
    const wet = (Math.max(0, Math.min(100, value)) / 100) * 0.85;
    this.echoWetGain?.gain.linearRampToValueAtTime(wet, this.ctx!.currentTime + 0.05);
  }

  setEchoTime(value: number): void {
    this.delayNode?.delayTime.linearRampToValueAtTime(this.mapEchoTime(value), this.ctx!.currentTime + 0.05);
  }

  setEchoFeedback(value: number): void {
    this.delayFeedback?.gain.linearRampToValueAtTime(this.mapEchoFeedback(value), this.ctx!.currentTime + 0.05);
  }

  setSweep(value: number): void {
    this.sweepAmount = Math.max(0, Math.min(100, value));
    const normalized = this.sweepAmount / 100;
    const type = this.sweepFilter?.type || 'lowpass';
    let freq = 20000;

    if (type === 'highpass') {
      const minF = 20;
      const maxF = 8000;
      freq = minF * Math.pow(maxF / minF, normalized);
    } else {
      const minF = type === 'notch' ? 250 : 180;
      const maxF = 20000;
      freq = maxF / Math.pow(maxF / minF, normalized);
    }

    this.sweepFilter?.frequency.linearRampToValueAtTime(freq, this.ctx!.currentTime + 0.05);
  }

  setFilterMode(mode: FXFilterMode): void {
    if (!this.sweepFilter) return;
    this.sweepFilter.type = mode;
    this.setSweep(this.sweepAmount);
  }

  setFilterResonance(value: number): void {
    const q = Math.max(0.2, Math.min(12, value));
    this.sweepFilter?.Q.linearRampToValueAtTime(q, this.ctx!.currentTime + 0.05);
  }

  setDrive(value: number): void {
    const amount = Math.max(0, Math.min(100, value)) / 100;
    this.driveMix?.gain.linearRampToValueAtTime(amount * 0.75, this.ctx!.currentTime + 0.05);
    this.driveDry?.gain.linearRampToValueAtTime(1 - amount * 0.65, this.ctx!.currentTime + 0.05);
    if (this.driveWet) {
      this.driveWet.curve = this.generateDriveCurve(amount) as Float32Array<ArrayBuffer>;
    }
  }

  setReverbTone(value: number): void {
    this.reverbToneFilter?.frequency.linearRampToValueAtTime(this.mapReverbTone(value), this.ctx!.currentTime + 0.05);
  }

  setPan(value: number): void {
    this.manualPanAmount = Math.max(-1, Math.min(1, (value / 50) - 1));
    this.pannerNode?.pan.linearRampToValueAtTime(this.manualPanAmount, this.ctx!.currentTime + 0.05);
    this.updateAutoPanGain();
  }

  setAutoPanDepth(value: number): void {
    this.autoPanDepthAmount = Math.max(0, Math.min(100, value)) / 100;
    this.updateAutoPanGain();
  }

  setAutoPanRate(value: number): void {
    const rate = Math.max(0.1, Math.min(8, value));
    this.autoPanOsc?.frequency.linearRampToValueAtTime(rate, this.ctx!.currentTime + 0.05);
  }

  setPitchSpeed(rate: number): void {
    if (this.audioElement) this.audioElement.playbackRate = rate;
  }

  private updateAutoPanGain(): void {
    const headroom = Math.max(0, 1 - Math.abs(this.manualPanAmount));
    this.autoPanGain?.gain.linearRampToValueAtTime(this.autoPanDepthAmount * headroom, this.ctx!.currentTime + 0.05);
  }

  applyFxState(values: Partial<FXState>): void {
    for (const [param, value] of Object.entries(values) as [keyof FXState, FXState[keyof FXState]][]) {
      switch (param) {
        case 'bassBoost': this.setBassBoost(value as number); break;
        case 'reverb': this.setReverb(value as number); break;
        case 'echo': this.setEcho(value as number); break;
        case 'sweep': this.setSweep(value as number); break;
        case 'pan': this.setPan(value as number); break;
        case 'pitchSpeed': this.setPitchSpeed(value as number); break;
        case 'filterMode': this.setFilterMode(value as FXFilterMode); break;
        case 'filterResonance': this.setFilterResonance(value as number); break;
        case 'drive': this.setDrive(value as number); break;
        case 'autoPanDepth': this.setAutoPanDepth(value as number); break;
        case 'autoPanRate': this.setAutoPanRate(value as number); break;
        case 'echoTime': this.setEchoTime(value as number); break;
        case 'echoFeedback': this.setEchoFeedback(value as number); break;
        case 'reverbTone': this.setReverbTone(value as number); break;
      }
    }
  }

  resetFx(): void {
    this.applyFxState(FX_DEFAULTS);
  }

  setVolume(vol: number): void {
    this.masterGain?.gain.linearRampToValueAtTime(vol, this.ctx!.currentTime + 0.05);
  }

  // --- Playback ---

  async play(): Promise<void> {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    if (this.outputRouteMode === 'media-element') {
      await this.outputElement?.play().catch((err) => {
        console.warn('Unable to start routed output stream:', err);
      });
    }
    await this.audioElement?.play();
  }

  pause(): void { this.audioElement?.pause(); }

  seek(time: number): void {
    if (this.audioElement) this.audioElement.currentTime = time;
  }

  // --- Analysis ---

  getFrequencyData(): Uint8Array {
    const data = new Uint8Array(this.analyser?.frequencyBinCount || 0);
    this.analyser?.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    const data = new Uint8Array(this.analyser?.frequencyBinCount || 0);
    this.analyser?.getByteTimeDomainData(data);
    return data;
  }

  getLatency(): number {
    if (!this.ctx) return 0;
    return (this.ctx.baseLatency || 0) * 1000;
  }

  getBufferSize(): number { return FFT_SIZE; }

  // --- Metering ---

  updateMeters(): MeterValues {
    if (!this.analyser || !this.analyserL || !this.analyserR) return this._meters;

    // RMS from frequency data
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < freqData.length; i++) {
      const v = freqData[i] / 255;
      sum += v * v;
      if (freqData[i] > peak) peak = freqData[i];
    }
    const rmsLinear = Math.sqrt(sum / freqData.length);
    const rmsDb = rmsLinear > 0 ? 20 * Math.log10(rmsLinear) : -60;
    const peakDb = peak > 0 ? 20 * Math.log10(peak / 255) : -60;

    // LUFS approximation (simplified: RMS - 0.691 + K-weighting approximation)
    const lufs = rmsDb - 0.691;

    // Gain reduction from compressor
    const gr = this.compressor?.reduction || 0;

    // Stereo width from L/R analysers
    const lData = new Float32Array(this.analyserL.frequencyBinCount);
    const rData = new Float32Array(this.analyserR.frequencyBinCount);
    this.analyserL.getFloatFrequencyData(lData);
    this.analyserR.getFloatFrequencyData(rData);
    let midSum = 0, sideSum = 0;
    const len = Math.min(lData.length, rData.length);
    for (let i = 0; i < len; i++) {
      const l = Math.pow(10, lData[i] / 20);
      const r = Math.pow(10, rData[i] / 20);
      const mid = (l + r) / 2;
      const side = Math.abs(l - r) / 2;
      midSum += mid * mid;
      sideSum += side * side;
    }
    const width = midSum > 0 ? Math.min(Math.sqrt(sideSum / midSum) * 100, 150) : 0;

    // Noise gate: if RMS below threshold, close gate
    if (this._noiseGateThreshold > 0) {
      const gateThresholdDb = -60 + (this._noiseGateThreshold / 100) * 60; // -60 to 0
      const gateOpen = rmsDb > gateThresholdDb;
      this.noiseGate?.gain.linearRampToValueAtTime(gateOpen ? 1 : 0, this.ctx!.currentTime + 0.02);
    } else {
      this.noiseGate?.gain.linearRampToValueAtTime(1, this.ctx!.currentTime + 0.02);
    }

    this._meters = { rmsDb, peakDb, lufs, gainReduction: gr, stereoWidth: width };
    return this._meters;
  }

  destroy(): void {
    this.audioElement?.pause();
    this.audioElement = null;
    if (this.outputElement) {
      this.outputElement.pause();
      this.outputElement.srcObject = null;
    }
    this.outputElement = null;
    this.outputDestination?.disconnect();
    this.outputDestination = null;
    this.autoPanOsc?.stop();
    this.autoPanOsc?.disconnect();
    this.autoPanOsc = null;
    this.autoPanGain?.disconnect();
    this.autoPanGain = null;
    this.source?.disconnect();
    this.ctx?.close();
    this.ctx = null;
  }
}

export const audioEngine = new AudioEngine();
