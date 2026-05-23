import { useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useQueueStore } from '@/stores/useQueueStore';
import {
  invokeAddFiles,
  invokeProcessQueue,
  invokeSeparateStems,
  invokeConvertFiles,
} from '@/lib/ipc';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';

function matchesShortcut(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+');
  const needsCtrl = parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');
  const mainKey = parts[parts.length - 1];
  if (needsCtrl !== (e.ctrlKey || e.metaKey)) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;
  return e.key.toLowerCase() === mainKey || e.key === mainKey;
}

export function useKeyboardShortcuts(): void {
  const store = useQueueStore;
  const settingsStore = useSettingsStore;

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent): Promise<void> {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const sc = settingsStore.getState().keyboardShortcuts ?? DEFAULT_KEYBOARD_SHORTCUTS;

      if (matchesShortcut(e, sc.selectAll)) {
        e.preventDefault();
        store.getState().selectAllJobs();
        return;
      }

      if (matchesShortcut(e, sc.deselect)) {
        store.getState().clearSelection();
        return;
      }

      if (matchesShortcut(e, sc.deleteSelected)) {
        const { selectedJobIds, jobs, setJobs } = store.getState();
        if (selectedJobIds.length > 0) {
          e.preventDefault();
          setJobs(jobs.filter((j) => !selectedJobIds.includes(j.id)));
          store.getState().clearSelection();
        }
        return;
      }

      if (matchesShortcut(e, sc.enhance)) {
        const { jobs } = store.getState();
        const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (pendingIds.length > 0) {
          const strength = settingsStore.getState().enhancementStrength;
          invokeProcessQueue(pendingIds, strength);
        }
        return;
      }

      if (matchesShortcut(e, sc.separate)) {
        const { jobs } = store.getState();
        const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (pendingIds.length > 0) invokeSeparateStems(pendingIds);
        return;
      }

      if (matchesShortcut(e, sc.convert)) {
        const { jobs } = store.getState();
        const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (pendingIds.length > 0) {
          const template = settingsStore.getState().filenameTemplate;
          invokeConvertFiles(pendingIds, template);
        }
        return;
      }

      if (matchesShortcut(e, sc.openFiles)) {
        e.preventDefault();
        const selected = await open({
          multiple: true,
          filters: [{ name: 'Audio / Video', extensions: ['mp3','wav','flac','aac','ogg','opus','m4a','wma','mp4','mkv','mov','avi','webm','flv'] }],
        });
        const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        if (paths.length > 0) {
          const res = await invokeAddFiles(paths);
          if (res.success && res.data) store.getState().addJobs(res.data);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, settingsStore]);
}
