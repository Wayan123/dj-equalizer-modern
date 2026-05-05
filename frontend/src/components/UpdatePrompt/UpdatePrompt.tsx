import React, { useEffect, useState } from 'react';
import { installWebUpdate, subscribeWebUpdate, WebUpdateState } from '../../platform/webUpdate';

export const UpdatePrompt: React.FC = () => {
  const [state, setState] = useState<WebUpdateState | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => subscribeWebUpdate(setState), []);

  if (!state?.available) return null;

  return (
    <div className="fixed right-3 bottom-16 z-[9999] w-[min(320px,calc(100vw-1.5rem))] rounded-md border border-neon-cyan/40 bg-dark-800/95 p-3 shadow-[0_0_22px_rgba(0,240,255,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono font-bold text-neon-cyan neon-text">UPDATE READY</div>
          <div className="mt-1 text-[9px] font-mono text-gray-400">
            Versi web baru tersedia. Reload saat siap agar playback tidak terputus mendadak.
          </div>
        </div>
        <button
          className="shrink-0 rounded border border-neon-green/50 bg-neon-green/10 px-2 py-1 text-[9px] font-mono font-bold text-neon-green transition-colors hover:bg-neon-green/20 disabled:opacity-50"
          disabled={isReloading}
          onClick={async () => {
            setIsReloading(true);
            await installWebUpdate();
          }}
        >
          {isReloading ? '...' : 'RELOAD'}
        </button>
      </div>
    </div>
  );
};
