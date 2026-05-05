import React, { useState, useCallback, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Visualizer } from './components/Visualizer';
import { Equalizer } from './components/Equalizer';
import { EnhancerPanel } from './components/EnhancerPanel/EnhancerPanel';
import { DJFX } from './components/DJFX';
import { AudioPlayer } from './components/AudioPlayer';
import { InputZone } from './components/InputZone';
import { PresetsPanel } from './components/PresetsPanel/PresetsPanel';
import { ManualPanel } from './components/ManualPanel';
import { FFTPanel } from './components/FFTPanel';
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel';
import { UpdatePrompt } from './components/UpdatePrompt';

type TabType = 'EQ' | 'ENHANCER' | 'FX' | 'VISUALIZER' | 'PRESETS' | 'MANUAL' | 'FFT' | 'SETTINGS';

const SIDEBAR_WIDTH_KEY = 'modern-audio-enhancer:sidebar-width';
const LEFT_PANEL_MIN_WIDTH = 560;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getSidebarBounds = () => {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const min = viewportWidth < 900 ? 300 : 360;
  const maxByViewport = Math.max(min, viewportWidth - LEFT_PANEL_MIN_WIDTH);
  const max = Math.min(680, maxByViewport);
  return { min, max };
};

const getDefaultSidebarWidth = () => {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const { min, max } = getSidebarBounds();
  return clamp(Math.round(viewportWidth * 0.32), min, Math.min(max, 460));
};

const getInitialSidebarWidth = () => {
  const { min, max } = getSidebarBounds();
  if (typeof window !== 'undefined') {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return clamp(stored, min, max);
    }
  }

  return getDefaultSidebarWidth();
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('EQ');
  const [visualizerHeight, setVisualizerHeight] = useState(70); 
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [isResizingY, setIsResizingY] = useState(false);
  const [isResizingX, setIsResizingX] = useState(false);

  const startResizingY = useCallback(() => setIsResizingY(true), []);
  const startResizingX = useCallback(() => setIsResizingX(true), []);
  const resetSidebarWidth = useCallback(() => setSidebarWidth(getDefaultSidebarWidth()), []);
  const stopResizing = useCallback(() => {
    setIsResizingY(false);
    setIsResizingX(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingY) {
      const topBarHeight = 48;
      const playerHeight = 56;
      const availableHeight = window.innerHeight - topBarHeight - playerHeight;
      const newHeight = ((e.clientY - topBarHeight) / availableHeight) * 100;
      setVisualizerHeight(Math.max(20, Math.min(80, newHeight)));
    }
    if (isResizingX) {
      const newWidth = window.innerWidth - e.clientX;
      const { min, max } = getSidebarBounds();
      setSidebarWidth(clamp(newWidth, min, max));
    }
  }, [isResizingY, isResizingX]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

  useEffect(() => {
    const clampSidebarToViewport = () => {
      const { min, max } = getSidebarBounds();
      setSidebarWidth((width) => clamp(width, min, max));
    };

    window.addEventListener('resize', clampSidebarToViewport);
    return () => window.removeEventListener('resize', clampSidebarToViewport);
  }, []);

  useEffect(() => {
    if (isResizingY || isResizingX) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingY, isResizingX, resize, stopResizing]);

  return (
    <div className={`flex flex-col h-screen w-screen bg-dark-900 overflow-hidden ${isResizingY ? 'cursor-row-resize' : isResizingX ? 'cursor-col-resize' : ''} select-none`}>
      {/* Top Bar */}
      <TopBar onTabChange={setActiveTab} />

      {/* Main Content — tab-based layout */}
      <div className="flex flex-1 min-h-0 p-1 gap-0 overflow-hidden">
        {/* Left panel */}
        <div className="flex flex-col flex-1 min-w-0 gap-0 overflow-hidden">
          {/* Full-page tabs (no visualizer) */}
          {activeTab === 'MANUAL' ? (
            <ManualPanel />
          ) : activeTab === 'FFT' ? (
            <FFTPanel />
          ) : activeTab === 'SETTINGS' ? (
            <SettingsPanel />
          ) : (
            <>
              {/* Visualization Panel — dynamic height */}
              <div
                className="panel-glow overflow-hidden"
                style={{ height: activeTab === 'VISUALIZER' ? '100%' : `${visualizerHeight}%` }}
              >
                <Visualizer />
              </div>

              {/* Y-Resizer — hidden when VISUALIZER tab is full */}
              {activeTab !== 'VISUALIZER' && (
                <div
                  className="h-1.5 hover:bg-neon-cyan/30 cursor-row-resize transition-colors flex items-center justify-center group shrink-0"
                  onMouseDown={startResizingY}
                >
                  <div className="w-8 h-0.5 bg-dark-500 rounded-full group-hover:bg-neon-cyan/50" />
                </div>
              )}

              {/* Tab content below visualizer */}
              {activeTab !== 'VISUALIZER' && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {activeTab === 'EQ' && <Equalizer />}
                  {activeTab === 'ENHANCER' && <EnhancerPanel />}
                  {activeTab === 'FX' && <DJFX />}
                  {activeTab === 'PRESETS' && <PresetsPanel />}
                </div>
              )}
            </>
          )}
        </div>

        {/* X-Resizer */}
        <div
          className="w-1.5 hover:bg-neon-magenta/30 cursor-col-resize transition-colors flex items-center justify-center group shrink-0 mx-0.5"
          onMouseDown={startResizingX}
          onDoubleClick={resetSidebarWidth}
          title="Resize input panel"
        >
          <div className="h-8 w-0.5 bg-dark-500 rounded-full group-hover:bg-neon-magenta/50" />
        </div>

        {/* Right sidebar: InputZone — always visible */}
        <div
          className="flex flex-col gap-1 shrink-0 min-w-0 overflow-hidden"
          style={{ width: `${sidebarWidth}px` }}
        >
          <InputZone />
        </div>
      </div>

      {/* Bottom: Audio Player */}
      <UpdatePrompt />
      <AudioPlayer />
    </div>
  );
};

export default App;
