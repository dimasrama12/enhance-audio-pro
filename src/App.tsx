import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useQueueStore } from '@/stores/useQueueStore';
import { useUIStore } from '@/stores/useUIStore';
import { invokeGetSettings, invokeGetQueue } from '@/lib/ipc';
import i18n from '@/i18n';
import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import DropZone from '@/components/DropZone';
import QueueToolbar from '@/components/QueueToolbar';
import QueueGrid from '@/components/QueueGrid';
import ManipulationPanel from '@/components/ManipulationPanel';
import QueueStatusBar from '@/components/QueueStatusBar';
import SettingsPanel from '@/components/SettingsPanel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function App(): JSX.Element {
  const { theme, language, setSettings, setInitialized } = useSettingsStore();
  const { setJobs } = useQueueStore();
  const { sidebarVisible, settingsOpen, closeSettings } = useUIStore();

  useKeyboardShortcuts();

  useEffect(() => {
    async function init(): Promise<void> {
      const [settingsRes, queueRes] = await Promise.all([
        invokeGetSettings(),
        invokeGetQueue(),
      ]);
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
      if (queueRes.success && queueRes.data) setJobs(queueRes.data);
      setInitialized(true);
    }
    init();
  }, [setSettings, setJobs, setInitialized]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (language && i18n.language !== language) i18n.changeLanguage(language);
  }, [language]);

  return (
    <div className="flex flex-col h-screen overflow-hidden transition-colors duration-200 bg-zinc-100 text-zinc-900 dark:bg-neutral-900 dark:text-white">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarVisible && <Sidebar />}
        <main className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
          <DropZone />
          <QueueToolbar />
          <QueueStatusBar />
          <QueueGrid />
          <ManipulationPanel />
        </main>
      </div>
      <SettingsPanel open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}
