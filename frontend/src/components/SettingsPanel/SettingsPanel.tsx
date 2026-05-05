import React, { useCallback, useEffect, useState } from 'react';
import { useAudioStore, ThemeType, VizVariant } from '../../store/audioStore';
import { audioEngine, AudioOutputDevice } from '../../audio/AudioEngine';
import { isTauri, platform, UpdateInfo, UpdateProgress } from '../../platform/platform';

const THEMES: { label: string; value: ThemeType; color: string }[] = [
  { label: 'Original (Default)', value: 'ORIGINAL', color: 'bg-gradient-to-r from-[#00f0ff] via-[#00ff88] to-[#ff00ff]' },
  { label: 'Neon Cyan', value: 'NEON_CYAN', color: 'bg-[#00f0ff]' },
  { label: 'Neon Magenta', value: 'NEON_MAGENTA', color: 'bg-[#ff00ff]' },
  { label: 'Neon Green', value: 'NEON_GREEN', color: 'bg-[#00ff88]' },
  { label: 'Gold', value: 'GOLD', color: 'bg-[#fbbf24]' },
  { label: 'Retro Amber', value: 'RETRO_AMBER', color: 'bg-[#f97316]' },
  { label: 'Ultra Violet', value: 'ULTRA_VIOLET', color: 'bg-[#8b5cf6]' },
];

const VIZ_VARIANTS: { label: string; value: VizVariant }[] = [
  { label: 'Standard', value: 'DEFAULT' },
  { label: 'Dense / High Detail', value: 'DENSE' },
  { label: 'Outline Only', value: 'OUTLINE' },
  { label: 'Filled / Solid', value: 'FILLED' },
  { label: 'Pure Glow', value: 'GLOW_ONLY' },
];

const DEFAULT_OUTPUT_DEVICE: AudioOutputDevice = {
  deviceId: 'default',
  label: 'System Default',
  isDefault: true,
};

export const SettingsPanel: React.FC = () => {
  const { theme, setTheme, vizVariant, setVizVariant } = useAudioStore();
  const [outputDevices, setOutputDevices] = useState<AudioOutputDevice[]>([DEFAULT_OUTPUT_DEVICE]);
  const [selectedOutputId, setSelectedOutputId] = useState(() => (
    localStorage.getItem('dj-eq-output-device') || audioEngine.currentOutputDeviceId
  ));
  const [outputStatus, setOutputStatus] = useState('SYSTEM DEFAULT');
  const [outputError, setOutputError] = useState('');
  const [isRefreshingOutputs, setIsRefreshingOutputs] = useState(false);
  const [isApplyingOutput, setIsApplyingOutput] = useState(false);
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState('READY');
  const [updateError, setUpdateError] = useState('');
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  const describeOutputRoute = useCallback((deviceId: string) => {
    if (deviceId === 'default') return 'SYSTEM DEFAULT';
    return audioEngine.outputRoute === 'media-element' ? 'DIRECT SINK ROUTE' : 'AUDIOCONTEXT SINK';
  }, []);

  const refreshOutputDevices = useCallback(async () => {
    setIsRefreshingOutputs(true);
    setOutputError('');
    try {
      const devices = await audioEngine.getOutputDevices();
      setOutputDevices(devices);
    } catch (err) {
      setOutputError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRefreshingOutputs(false);
    }
  }, []);

  const applyOutputDevice = useCallback(async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    setIsApplyingOutput(true);
    setOutputError('');
    try {
      await audioEngine.setOutputDevice(deviceId);
      localStorage.setItem('dj-eq-output-device', deviceId);
      setOutputStatus(describeOutputRoute(deviceId));
    } catch (err) {
      setOutputError(err instanceof Error ? err.message : String(err));
      setSelectedOutputId(audioEngine.currentOutputDeviceId);
      setOutputStatus(describeOutputRoute(audioEngine.currentOutputDeviceId));
    } finally {
      setIsApplyingOutput(false);
    }
  }, [describeOutputRoute]);

  const promptOutputDevice = useCallback(async () => {
    setIsApplyingOutput(true);
    setOutputError('');
    try {
      const device = await audioEngine.promptForOutputDevice();
      if (!device) throw new Error('Output picker is not supported by this WebView.');
      setOutputDevices((devices) => {
        if (devices.some((item) => item.deviceId === device.deviceId)) return devices;
        return [...devices, device];
      });
      await applyOutputDevice(device.deviceId);
    } catch (err) {
      setOutputError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsApplyingOutput(false);
    }
  }, [applyOutputDevice]);

  const refreshAppVersion = useCallback(async () => {
    try {
      setAppVersion(await platform.getRuntimeVersion());
    } catch (err) {
      console.warn('Unable to read app version:', err);
    }
  }, []);

  const checkForAppUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateError('');
    setUpdateProgress(null);
    try {
      const info = await platform.checkForUpdate();
      setUpdateInfo(info);
      setUpdateStatus(info.message);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
      setUpdateStatus('CHECK FAILED');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const installAppUpdate = useCallback(async () => {
    setIsInstallingUpdate(true);
    setUpdateError('');
    try {
      await platform.installUpdate((progress) => {
        setUpdateProgress(progress);
        setUpdateStatus(progress.message);
      });
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
      setUpdateStatus('INSTALL FAILED');
      setIsInstallingUpdate(false);
    }
  }, []);

  useEffect(() => {
    refreshOutputDevices();
    refreshAppVersion();

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return undefined;

    mediaDevices.addEventListener('devicechange', refreshOutputDevices);
    return () => mediaDevices.removeEventListener('devicechange', refreshOutputDevices);
  }, [refreshOutputDevices, refreshAppVersion]);

  useEffect(() => {
    const savedOutputId = localStorage.getItem('dj-eq-output-device');
    if (savedOutputId && savedOutputId !== audioEngine.currentOutputDeviceId) {
      applyOutputDevice(savedOutputId);
    }
  }, [applyOutputDevice]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-dark-900 custom-scrollbar">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-mono font-bold text-white mb-1 tracking-tight">System Settings</h2>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Configuration & Personalization</p>
        </div>

        {/* Audio Output */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-mono font-bold text-neon-magenta flex items-center gap-2">
              <span className="w-1.5 h-4 bg-neon-magenta/50 rounded-full" />
              AUDIO OUTPUT
            </h3>
            <div className="flex items-center gap-2">
              {audioEngine.supportsOutputDevicePrompt && (
                <button
                  className="px-2.5 py-1 text-[9px] font-mono rounded border border-neon-magenta/50 text-neon-magenta
                    bg-neon-magenta/5 hover:bg-neon-magenta/15 transition-colors disabled:opacity-40"
                  onClick={promptOutputDevice}
                  disabled={isApplyingOutput}
                >
                  PICK
                </button>
              )}
              <button
                className="px-2.5 py-1 text-[9px] font-mono rounded border border-neon-cyan/50 text-neon-cyan
                  bg-neon-cyan/5 hover:bg-neon-cyan/15 transition-colors disabled:opacity-40"
                onClick={refreshOutputDevices}
                disabled={isRefreshingOutputs}
              >
                {isRefreshingOutputs ? '...' : 'SCAN'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <select
              value={selectedOutputId}
              onChange={(event) => applyOutputDevice(event.target.value)}
              className="min-w-0 px-3 py-2 text-[10px] font-mono bg-dark-800/80 border border-dark-500/50 rounded
                text-gray-200 focus:border-neon-magenta focus:outline-none transition-colors"
            >
              {outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.isDefault ? 'System Default' : device.label}
                </option>
              ))}
            </select>
            <div className={`px-3 py-2 rounded border text-[9px] font-mono text-center ${
              isApplyingOutput
                ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/5'
                : outputError
                ? 'border-red-500/40 text-red-400 bg-red-500/5'
                : 'border-neon-green/40 text-neon-green bg-neon-green/5'
            }`}>
              {isApplyingOutput ? 'SWITCHING' : outputError ? 'CHECK OUTPUT' : outputStatus}
            </div>
          </div>

          {!audioEngine.supportsOutputDeviceSelection && (
            <div className="text-[10px] font-mono text-yellow-400/90 bg-yellow-400/5 border border-yellow-400/20 rounded px-3 py-2">
              Output switching is not exposed by this WebView. Use Start_DJ_Equalizer.bat in Windows app mode or set the OS default output.
            </div>
          )}

          {outputError && (
            <div className="text-[10px] font-mono text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2 break-words">
              {outputError}
            </div>
          )}
        </section>

        {/* App Update */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-mono font-bold text-neon-green flex items-center gap-2">
              <span className="w-1.5 h-4 bg-neon-green/50 rounded-full" />
              APP UPDATE
            </h3>
            <button
              className="px-2.5 py-1 text-[9px] font-mono rounded border border-neon-green/50 text-neon-green
                bg-neon-green/5 hover:bg-neon-green/15 transition-colors disabled:opacity-40"
              onClick={checkForAppUpdate}
              disabled={isCheckingUpdate || isInstallingUpdate}
            >
              {isCheckingUpdate ? '...' : 'CHECK'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded border border-dark-500/40 bg-dark-800/50 px-3 py-2">
              <div className="text-[8px] font-mono text-gray-500">VERSION</div>
              <div className="mt-1 text-[10px] font-mono text-gray-200">{appVersion}</div>
            </div>
            <div className="rounded border border-dark-500/40 bg-dark-800/50 px-3 py-2">
              <div className="text-[8px] font-mono text-gray-500">RUNTIME</div>
              <div className="mt-1 text-[10px] font-mono text-gray-200">{isTauri() ? 'TAURI DESKTOP' : 'WEB PWA'}</div>
            </div>
            <div className="rounded border border-dark-500/40 bg-dark-800/50 px-3 py-2">
              <div className="text-[8px] font-mono text-gray-500">CHANNEL</div>
              <div className="mt-1 text-[10px] font-mono text-gray-200">{isTauri() ? 'INTERNAL-LOCAL' : 'WEB-PWA'}</div>
            </div>
          </div>

          <div className={`rounded border px-3 py-2 text-[10px] font-mono ${
            updateError
              ? 'border-red-500/30 bg-red-500/5 text-red-400'
              : updateInfo?.available
              ? 'border-neon-green/40 bg-neon-green/5 text-neon-green'
              : 'border-dark-500/40 bg-dark-800/50 text-gray-400'
          }`}>
            {updateError || (
              updateInfo?.available
                ? `Update ${updateInfo.version || 'baru'} tersedia`
                : updateStatus
            )}
          </div>

          {updateInfo?.body && (
            <div className="rounded border border-dark-500/30 bg-dark-800/40 px-3 py-2 text-[10px] font-mono text-gray-400 whitespace-pre-wrap">
              {updateInfo.body}
            </div>
          )}

          {updateProgress && (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-dark-600">
                <div
                  className="h-full rounded-full bg-neon-green transition-all duration-300"
                  style={{ width: `${updateProgress.percent ?? 15}%` }}
                />
              </div>
              <div className="text-[8px] font-mono text-gray-500">
                {updateProgress.message}
                {updateProgress.percent !== null ? ` ${updateProgress.percent.toFixed(0)}%` : ''}
              </div>
            </div>
          )}

          {updateInfo?.available && (
            <button
              className="w-full rounded border border-neon-green/50 bg-neon-green/10 px-3 py-2 text-[10px] font-mono font-bold text-neon-green transition-colors hover:bg-neon-green/20 disabled:opacity-40"
              onClick={installAppUpdate}
              disabled={isInstallingUpdate}
            >
              {isInstallingUpdate ? 'INSTALLING UPDATE...' : isTauri() ? 'INSTALL & RELAUNCH' : 'RELOAD WEB APP'}
            </button>
          )}
        </section>

        {/* Theme Selection */}
        <section className="space-y-4">
          <h3 className="text-sm font-mono font-bold text-neon-cyan flex items-center gap-2">
            <span className="w-1.5 h-4 bg-neon-cyan/50 rounded-full" />
            UI THEME COLOR
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex flex-col gap-2 p-3 rounded-lg border transition-all text-left ${
                  theme === t.value 
                    ? 'bg-dark-700 border-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)]' 
                    : 'bg-dark-800/40 border-dark-500/30 hover:border-dark-500'
                }`}
              >
                <div className={`w-full h-2 rounded-full ${t.color}`} />
                <span className={`text-[10px] font-mono font-bold ${theme === t.value ? 'text-white' : 'text-gray-400'}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Visualizer Settings */}
        <section className="space-y-4">
          <h3 className="text-sm font-mono font-bold text-neon-green flex items-center gap-2">
            <span className="w-1.5 h-4 bg-neon-green/50 rounded-full" />
            VISUALIZER VARIANTS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VIZ_VARIANTS.map((v) => (
              <button
                key={v.value}
                onClick={() => setVizVariant(v.value)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  vizVariant === v.value 
                    ? 'bg-dark-700 border-neon-green shadow-[0_0_10px_rgba(0,255,136,0.1)]' 
                    : 'bg-dark-800/40 border-dark-500/30 hover:border-dark-500'
                }`}
              >
                <span className={`text-[10px] font-mono font-bold ${vizVariant === v.value ? 'text-white' : 'text-gray-400'}`}>
                  {v.label}
                </span>
                {vizVariant === v.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-green shadow-neon-green" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Info */}
        <div className="pt-8 border-t border-dark-500/20">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-gray-500">VERSION: {appVersion}</span>
            <span className="text-[10px] font-mono text-gray-500">ENGINE: WEB AUDIO API + YOUTUBE-DL</span>
            <span className="text-[10px] font-mono text-gray-500">UPDATE CHANNEL: {isTauri() ? 'INTERNAL-LOCAL' : 'WEB-PWA'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
