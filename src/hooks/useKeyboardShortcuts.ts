import { useEffect } from 'react';
import { useQueueStore } from '@/stores/useQueueStore';
import {
  invokeProcessQueue,
  invokeSeparateStems,
  invokeConvertFiles,
} from '@/lib/ipc';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useKeyboardShortcuts(): void {
  const store = useQueueStore;
  const settingsStore = useSettingsStore;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'a') {
        e.preventDefault();
        store.getState().selectAllJobs();
        return;
      }

      if (e.key === 'Escape') {
        store.getState().clearSelection();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedJobIds, jobs, setJobs } = store.getState();
        if (selectedJobIds.length > 0) {
          e.preventDefault();
          setJobs(jobs.filter((j) => !selectedJobIds.includes(j.id)));
          store.getState().clearSelection();
        }
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        const { jobs } = store.getState();
        const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (pendingIds.length > 0) {
          const strength = settingsStore.getState().enhancementStrength;
          invokeProcessQueue(pendingIds, strength);
        }
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        const { jobs } = store.getState();
        const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (pendingIds.length > 0) invokeSeparateStems(pendingIds);
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        const { jobs } = store.getState();
        const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (pendingIds.length > 0) invokeConvertFiles(pendingIds);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, settingsStore]);
}
