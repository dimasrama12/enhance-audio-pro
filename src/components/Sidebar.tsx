import { useState } from 'react';
import { Music, Video, Settings, Clock, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import HistoryPanel from '@/components/HistoryPanel';
import { useUIStore, type AppTab } from '@/stores/useUIStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

export default function Sidebar(): JSX.Element {
  const { activeTab, setActiveTab, openSettings } = useUIStore();
  const store = useSettingsStore();
  const [historyOpen, setHistoryOpen] = useState(false);

  const tabs: { id: AppTab; label: string; Icon: typeof Music }[] = [
    { id: 'audio', label: 'Audio', Icon: Music },
    { id: 'video', label: 'Video', Icon: Video },
  ];

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

  const btnBase = 'p-2 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 hover:bg-zinc-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10';

  return (
    <>
      <aside className="flex flex-col w-16 bg-zinc-200 dark:bg-neutral-950 items-center py-4 gap-2 shrink-0 transition-colors duration-200">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex flex-col items-center gap-1 p-2 rounded-lg w-12 transition-colors',
              activeTab === id
                ? 'bg-violet-600 text-white'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10'
            )}
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            historyOpen
              ? 'bg-violet-600 text-white'
              : btnBase
          )}
          title="Recent files"
        >
          <Clock size={18} />
        </button>
        <button
          onClick={toggleTheme}
          title={store.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className={btnBase}
        >
          {store.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={openSettings}
          className={btnBase}
          title="Settings (Ctrl+,)"
        >
          <Settings size={18} />
        </button>
      </aside>
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}
