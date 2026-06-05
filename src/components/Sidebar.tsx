import { Music, Video, Settings, Clock, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';
import HistoryPanel from '@/components/HistoryPanel';
import { useUIStore, type AppTab } from '@/stores/useUIStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

export default function Sidebar(): JSX.Element {
  const { activeTab, setActiveTab, openSettings, historyOpen, toggleHistory, closeHistory } = useUIStore();
  const store = useSettingsStore();

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
      recordingPrefix: store.recordingPrefix ?? 'Record',
      aiModel: store.aiModel ?? 'deepfilternet',
    };
    await invokeSaveSettings(settings);
  };

  const utilBtn = clsx(
    'p-2 rounded-lg transition-colors duration-150',
    'text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white',
    'hover:bg-slate-200 dark:hover:bg-white/[0.08]',
  );

  return (
    <>
      <aside className="flex flex-col w-16 bg-[#EFF2F6] dark:bg-[#080D18] border-r border-slate-200 dark:border-white/[0.06] items-center py-3 gap-1.5 shrink-0 transition-colors duration-200">
        {/* Nav tabs */}
        <div className="flex flex-col gap-1 w-full px-2">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              title={`${label} tab`}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-2 rounded-xl w-full transition-all duration-150',
                activeTab === id
                  ? [
                      'bg-white dark:bg-white/[0.08]',
                      'text-violet-600 dark:text-violet-400',
                      'shadow-sm dark:shadow-none',
                      'border-2 border-violet-300 dark:border-violet-500/50',
                    ]
                  : [
                      'text-slate-500 dark:text-white/40',
                      'hover:text-slate-800 dark:hover:text-white',
                      'hover:bg-slate-200/60 dark:hover:bg-white/[0.05]',
                      'border-2 border-transparent',
                    ]
              )}
            >
              <Icon size={17} />
              <span className="text-[9px] font-semibold tracking-wide">{label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-8 border-t border-slate-300 dark:border-white/[0.08] my-1" />

        <div className="flex-1" />

        {/* Utility cluster */}
        <div className="flex flex-col gap-1 w-full px-2">
          <button
            onClick={toggleHistory}
            title="Recent files [Ctrl+H]"
            className={clsx(
              'p-2 w-full flex items-center justify-center rounded-xl transition-all duration-150',
              historyOpen
                ? 'bg-violet-600 text-white shadow-glow-violet-sm'
                : utilBtn,
            )}
          >
            <Clock size={17} />
          </button>
          <button
            onClick={toggleTheme}
            title={store.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={clsx('w-full flex items-center justify-center rounded-xl', utilBtn)}
          >
            {store.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={openSettings}
            title="Settings (Ctrl+,)"
            className={clsx('w-full flex items-center justify-center rounded-xl', utilBtn)}
          >
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <HistoryPanel open={historyOpen} onClose={closeHistory} />
    </>
  );
}
