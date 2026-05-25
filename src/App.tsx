import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeGetSettings, invokeGetQueue } from '@/lib/ipc';
import i18n from '@/i18n';
import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import DropZone from '@/components/DropZone';
import QueueToolbar from '@/components/QueueToolbar';
import QueueGrid from '@/components/QueueGrid';
import ManipulationPanel from '@/components/ManipulationPanel';
import HelpPanel from '@/components/HelpPanel';
import QueueStatusBar from '@/components/QueueStatusBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function App(): JSX.Element {
  const { theme, language, setSettings, setInitialized } = useSettingsStore();
  const { setJobs } = useQueueStore();
  const [helpOpen, setHelpOpen] = useState(false);

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
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white overflow-hidden">
      <TitleBar onHelpOpen={() => setHelpOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
          <DropZone />
          <QueueToolbar />
          <QueueStatusBar />
          <QueueGrid />
          <ManipulationPanel />
        </main>
      </div>
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
