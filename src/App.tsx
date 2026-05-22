import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeGetSettings, invokeGetQueue } from '@/lib/ipc';
import SetupWizard from '@/components/SetupWizard';
import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import DropZone from '@/components/DropZone';
import QueueToolbar from '@/components/QueueToolbar';
import QueueGrid from '@/components/QueueGrid';
import ManipulationPanel from '@/components/ManipulationPanel';

export default function App(): JSX.Element {
  const { theme, setupComplete, setSettings, setInitialized } = useSettingsStore();
  const { setJobs } = useQueueStore();

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

  if (!setupComplete) return <SetupWizard />;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
          <DropZone />
          <QueueToolbar />
          <QueueGrid />
          <ManipulationPanel />
        </main>
      </div>
    </div>
  );
}
