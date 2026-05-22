import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, HelpCircle } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

interface Props {
  onHelpOpen?: () => void;
}

export default function TitleBar({ onHelpOpen }: Props): JSX.Element {
  const store = useSettingsStore();
  const win = getCurrentWindow();

  const toggleTheme = async (): Promise<void> => {
    const next = store.theme === 'dark' ? 'light' : 'dark';
    store.setTheme(next);
    const settings: AppSettings = {
      theme: next,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: store.setupComplete,
      enhancementStrength: store.enhancementStrength,
    };
    await invokeSaveSettings(settings);
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
        <button onClick={() => win.minimize()} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <Minus size={12} />
        </button>
        <button onClick={() => win.toggleMaximize()} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <Square size={12} />
        </button>
        <button onClick={() => win.close()} className="p-1.5 rounded hover:bg-red-500 text-white/50 hover:text-white transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
