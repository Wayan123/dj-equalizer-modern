# Technical Manual — Modern Audio Enhancer

## DSP Pipeline

### Audio Graph

The entire audio processing pipeline runs in the browser via the Web Audio API. No server-side DSP occurs.

```
HTMLAudioElement
  → MediaElementAudioSourceNode
  → GainNode (Input Gain)
  → GainNode (Noise Gate)
  → BiquadFilterNode × 10 (EQ)
  → DynamicsCompressorNode (Compressor)
  → DynamicsCompressorNode (Limiter)
  → WaveShaperNode + dry/wet GainNodes (Exciter)
  → Mid/Side GainNodes (Stereo Widener)
  → BiquadFilterNode (Bass Boost: lowshelf)
  → BiquadFilterNode (Sweep: LP/HP/Notch + Q)
  → WaveShaperNode + dry/wet GainNodes (Drive)
  → DelayNode + wet/feedback GainNodes (Echo)
  → ConvolverNode + tone filter + dry/wet GainNodes (Reverb)
  → StereoPannerNode (Pan: -1 to 1)
  → AnalyserNode (FFT extraction for visualization)
  → GainNode (Master volume)
  → AudioContext.destination
```

### EQ Implementation

10 `BiquadFilterNode` instances in series:

| Band | Frequency | Filter Type | Q |
|------|-----------|-------------|---|
| 1 | 31 Hz | lowshelf | — |
| 2 | 62 Hz | peaking | 1.4 |
| 3 | 125 Hz | peaking | 1.4 |
| 4 | 250 Hz | peaking | 1.4 |
| 5 | 500 Hz | peaking | 1.4 |
| 6 | 1 kHz | peaking | 1.4 |
| 7 | 2 kHz | peaking | 1.4 |
| 8 | 4 kHz | peaking | 1.4 |
| 9 | 8 kHz | peaking | 1.4 |
| 10 | 16 kHz | highshelf | — |

Gain range: -12 dB to +12 dB. All parameter changes use `linearRampToValueAtTime` with 50ms ramp to prevent audio clicks.

### FFT Analysis

- `AnalyserNode.fftSize` = 2048
- `frequencyBinCount` = 1024
- `smoothingTimeConstant` = 0.8
- `getByteFrequencyData()` → Uint8Array (0–255 per bin)
- `getByteTimeDomainData()` → Uint8Array (128 = center, 0–255 range)

Frequency resolution: `sampleRate / fftSize` ≈ 21.5 Hz per bin at 44100 Hz.

### Effects

**Bass Boost**: `BiquadFilterNode` lowshelf around 95 Hz, gain mapped from 0 dB to +12 dB.

**Reverb**: `ConvolverNode` with procedurally generated impulse response (2 seconds, exponential decay). Wet/dry mix is followed by a low-pass tone filter for damping.

**Echo**: `DelayNode` (max 2s) with feedback loop through `GainNode`. Wet gain is separated from feedback so echo off remains dry-only. Delay time: 0.06-1.0s, feedback: 0-0.75.

**Sweep**: `BiquadFilterNode` with lowpass, highpass, or notch mode and resonance control. Frequency is swept logarithmically.

**Drive**: `WaveShaperNode` soft saturation in a parallel dry/wet path.

**Auto Pan**: `OscillatorNode` LFO through `GainNode` into `StereoPannerNode.pan`, combined with manual pan.

**Pan**: `StereoPannerNode` with pan from -1 (full left) to +1 (full right).

**Pitch/Speed**: `HTMLAudioElement.playbackRate` from 0.25× to 4×.

## Visualization System

### Render Loop

`requestAnimationFrame`-based loop managed by `RenderLoop` class:
- FPS counter updated every 1 second
- Canvas resized via `ResizeObserver` + `devicePixelRatio` scaling
- Idle state shows "LOAD AUDIO TO ACTIVATE" text

### Mode Implementations

| Mode | Technique | Data Source |
|------|-----------|-------------|
| FFT | `fillRect` bars with vertical gradient | `getByteFrequencyData` |
| WAVE | `lineTo` path with dual-color stroke | `getByteTimeDomainData` |
| RADIAL | Polar coordinate bars from center | `getByteFrequencyData` |
| PARTICLE | Particle pool with velocity/life/size | `getByteFrequencyData` (energy) |
| STEREO | Horizontal L/R bars from center | `getByteFrequencyData` (split) |
| SPECTRO | Scrolling `putImageData` heatmap | `getByteFrequencyData` |
| VU | Segmented level meters with decay | `getByteFrequencyData` (RMS) |

### Neon Glow

Achieved via Canvas 2D `shadowBlur` + `shadowColor`:
```typescript
ctx.shadowColor = '#00f0ff';
ctx.shadowBlur = 15;
// draw shape
ctx.shadowBlur = 0; // reset
```

### Color System

Frequency-reactive gradient: low energy → cyan, mid → green/yellow, high → magenta/pink. Implemented via `lerpColor()` in `gradients.ts`.

## Performance Considerations

- **Canvas 2D** chosen over WebGL: sufficient for 2D spectrum, simpler debugging
- **Particle pool** capped at 300 to prevent FPS drops
- **Spectrogram** uses `ImageData` direct pixel manipulation for speed
- **VU meters** use exponential decay (0.92) for smooth animation without extra computation
- **All audio param changes** use `linearRampToValueAtTime` to prevent click artifacts
- **ResizeObserver** handles canvas resize without polling

## Backend

### YouTube Extraction

`POST /api/youtube/extract`

1. Validate URL format (regex + hostname check)
2. Run `yt-dlp --format bestaudio --dump-json` as async subprocess
3. Timeout after 30 seconds
4. Return audio stream URL + title to frontend
5. Frontend plays via `HTMLAudioElement.src`
6. Stream URLs are limited to trusted media hosts such as `googlevideo.com`

### Rate Limiting

`slowapi` limits the YouTube endpoints to 5 requests/minute per IP for extraction and 3 requests/minute for search.

### File Upload

`POST /api/audio/upload`

- Accepts audio/video MIME types only
- Max 100MB
- Files saved to `/tmp/dj-eq-uploads/` with sanitized filenames
- The response returns the sanitized file name, not an absolute server path
