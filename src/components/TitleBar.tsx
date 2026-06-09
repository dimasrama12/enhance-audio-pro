import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';

function WaveformIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="5" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="3" y="3" width="2" height="8" rx="1" fill="currentColor" />
      <rect x="6" y="1" width="2" height="12" rx="1" fill="currentColor" />
      <rect x="9" y="3" width="2" height="8" rx="1" fill="currentColor" />
      <rect x="12" y="5" width="2" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function TitleBar(): JSX.Element {
  const win = getCurrentWindow();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let unlistenResize: (() => void) | undefined;

    const setup = async (): Promise<void> => {
      setIsFullscreen(await win.isFullscreen());
      unlistenResize = await win.onResized(async () => {
        setIsFullscreen(await win.isFullscreen());
      });
    };

    setup().catch(() => {});
    return () => { unlistenResize?.(); };
  }, []);

  const winBtn = 'p-1.5 rounded-md transition-colors duration-150';

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-[36px] px-3 bg-[#EFF2F6] dark:bg-[#080D18] border-b border-slate-200 dark:border-white/[0.06] select-none shrink-0 transition-colors duration-200"
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="text-violet-600 dark:text-violet-400">
          <WaveformIcon />
        </span>
        <span className="text-xs font-semibold tracking-tight text-slate-700 dark:text-zinc-100" data-tauri-drag-region>
          Enhance Audio Pro
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => win.minimize()}
          title="Minimize"
          className={`${winBtn} text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10`}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={async () => { const full = await win.isFullscreen(); await win.setFullscreen(!full); }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className={`${winBtn} text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10`}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
        <button
          onClick={() => win.close()}
          title="Close"
          className={`${winBtn} text-slate-400 dark:text-white/40 hover:text-white hover:bg-red-500 dark:hover:bg-red-500`}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
