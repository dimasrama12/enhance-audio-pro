import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';

export default function TitleBar(): JSX.Element {
  const win = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlistenResize: (() => void) | undefined;

    const setup = async (): Promise<void> => {
      setIsMaximized(await win.isMaximized());
      unlistenResize = await win.onResized(async () => {
        setIsMaximized(await win.isMaximized());
      });
    };

    setup().catch(() => {});
    return () => { unlistenResize?.(); };
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-[35.5px] px-4 bg-zinc-800 dark:bg-neutral-950 select-none shrink-0 transition-colors duration-200"
    >
      <span className="text-sm font-semibold text-white/70" data-tauri-drag-region>
        Enhance Audio Pro
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => win.minimize()}
          title="Minimize"
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          title={isMaximized ? 'Restore' : 'Maximize'}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
        <button
          onClick={() => win.close()}
          title="Close"
          className="p-1.5 rounded hover:bg-red-500 text-white/50 hover:text-white transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
