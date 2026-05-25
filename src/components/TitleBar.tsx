import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Maximize2, Minimize2, X, HelpCircle } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

interface Props {
  onHelpOpen?: () => void;
}

export default function TitleBar({ onHelpOpen }: Props): JSX.Element {
  const store = useSettingsStore();
  const win = getCurrentWindow();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    win.isFullscreen().then(setIsFullscreen).catch(() => {});
  }, []);

  const toggleTheme = async (): Promise<void> => {
    const next = store.theme === 'dark' ? 'light' : 'dark';
    store.setTheme(next);
    const settings: AppSettings = {
      theme: next,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: store.setupComplete,
      enhancementStrength: store.enhancementStrength,
      filenameTemplate: store.filenameTemplate,
      keyboardShortcuts: store.keyboardShortcuts,
    };
    await invokeSaveSettings(settings);
  };

  const toggleFullscreen = async (): Promise<void> => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    await win.setFullscreen(next);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-4 bg-neutral-950 select-none shrink-0"
    >
      <span className="text-sm font-semibold text-white/70" data-tauri-drag-region>
        Enhance Audio Pro
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="text-white/40 hover:text-white text-xs w-6 h-6 flex items-center justify-center transition-colors"
          title="Toggle theme"
        >
          {store.theme === 'dark' ? '☀' : '☾'}
        </button>
        {onHelpOpen && (
          <button
            onClick={onHelpOpen}
            title="User Guide"
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <HelpCircle size={14} />
          </button>
        )}
        <button
          onClick={() => win.minimize()}
          title="Minimize"
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
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
