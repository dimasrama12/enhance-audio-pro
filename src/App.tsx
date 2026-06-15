import { useEffect, useRef } from 'react';
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
  const { sidebarVisible, settingsOpen, closeSettings, isImporting } = useUIStore();

  useKeyboardShortcuts();

  const settingsRef = useRef(useSettingsStore.getState);

  useEffect(() => {
    async function init(): Promise<void> {
      const [settingsRes, queueRes] = await Promise.all([
        invokeGetSettings(),
        invokeGetQueue(),
      ]);
      if (settingsRes.success && settingsRes.data) {
        const persisted = settingsRef.current();
        // Merge: Zustand localStorage is the source of truth for UI state.
        setSettings({
          ...settingsRes.data,
          ...persisted,
        });
      }
      if (queueRes.success && queueRes.data) setJobs(queueRes.data);
      // Empty the file queues on startup for enhance, convert, and separate tabs
      // We check sessionStorage so we don't clear the queue on Ctrl+R page reloads!
      if (!sessionStorage.getItem('app_initialized')) {
        sessionStorage.setItem('app_initialized', 'true');
        useQueueStore.getState().setJobs([], 'enhance');
        useQueueStore.getState().setJobs([], 'convert');
        useQueueStore.getState().setJobs([], 'separate');
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
      {isImporting && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-white/10 dark:bg-black/40 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-white tracking-wide">
              {language === 'id' ? 'Memasukkan file...' : 'Importing files...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
