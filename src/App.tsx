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
import ContextMenu from '@/components/ContextMenu';
import ToastContainer from '@/components/ToastContainer';
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
      if (settingsRes.success && settingsRes.data) {
        // Only pull UI-preference fields from localStorage (mirrors partialize).
        // Backend-authoritative fields (setupComplete, aiModel) always come from Rust.
        const cached = useSettingsStore.getState();
        setSettings({
          ...settingsRes.data,
          theme: cached.theme,
          outputFolder: cached.outputFolder,
          language: cached.language,
          enhancementStrength: cached.enhancementStrength,
          hfDeHissDb: cached.hfDeHissDb,
          filenameTemplate: cached.filenameTemplate,
          filenameTemplateConverted: cached.filenameTemplateConverted,
          keyboardShortcuts: cached.keyboardShortcuts,
          customDefaultShortcuts: cached.customDefaultShortcuts,
          recordingPrefix: cached.recordingPrefix,
          scratchDiskDir: cached.scratchDiskDir,
        });
      }
      if (queueRes.success && queueRes.data) setJobs(queueRes.data);
      // Empty the file queues on startup for enhance, convert, and separate tabs
      // We check sessionStorage so we don't clear the queue on Ctrl+R page reloads!
      if (!sessionStorage.getItem('app_initialized')) {
        sessionStorage.setItem('app_initialized', 'true');
        useQueueStore.getState().setJobs([], 'enhance');
        useQueueStore.getState().setJobs([], 'convert');
      }
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
    <div className="flex flex-col h-screen overflow-hidden transition-colors duration-200 bg-[#F8FAFC] text-slate-900 dark:bg-[#0B0F1A] dark:text-slate-100">
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
      <ContextMenu />
      <ToastContainer />
    </div>
  );
}
