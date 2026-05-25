import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import {
  invokeAddFiles,
  invokeConvertFiles,
  invokeProcessQueue,
  invokeSeparateStems,
  invokeSaveSettings,
} from '@/lib/ipc';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';
import type { AppSettings } from '@/types/settings';

function matches(e: KeyboardEvent, binding: string): boolean {
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
  useEffect(() => {
    async function handler(e: KeyboardEvent): Promise<void> {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const q = useQueueStore.getState();
      const s = useSettingsStore.getState();
      const ui = useUIStore.getState();
      // Merge stored shortcuts with defaults so new keys always have a binding
      const sc: typeof DEFAULT_KEYBOARD_SHORTCUTS = {
        ...DEFAULT_KEYBOARD_SHORTCUTS,
        ...(s.keyboardShortcuts ?? {}),
      };
      const win = getCurrentWindow();

      const saveSettings = async (patch: Partial<AppSettings>): Promise<void> => {
        const next: AppSettings = {
          theme: s.theme,
          outputFolder: s.outputFolder,
          language: s.language,
          setupComplete: s.setupComplete,
          enhancementStrength: s.enhancementStrength,
          filenameTemplate: s.filenameTemplate,
          keyboardShortcuts: s.keyboardShortcuts,
          ...patch,
        };
        s.setSettings(next);
        await invokeSaveSettings(next);
      };

      // ── Queue actions ──────────────────────────────────────────────────────
      if (matches(e, sc.enhance)) {
        const ids = q.jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (ids.length) invokeProcessQueue(ids, s.enhancementStrength);
        return;
      }
      if (matches(e, sc.separate)) {
        const ids = q.jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (ids.length) invokeSeparateStems(ids);
        return;
      }
      if (matches(e, sc.convert)) {
        const ids = q.jobs.filter((j) => j.status === 'pending').map((j) => j.id);
        if (ids.length) invokeConvertFiles(ids, s.filenameTemplate);
        return;
      }
      if (matches(e, sc.openFiles)) {
        e.preventDefault();
        const selected = await open({
          multiple: true,
          filters: [{ name: 'Audio / Video', extensions: ['mp3','wav','flac','aac','ogg','opus','m4a','wma','mp4','mkv','mov','avi','webm','flv'] }],
        });
        const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        if (paths.length) {
          const res = await invokeAddFiles(paths);
          if (res.success && res.data) q.addJobs(res.data);
        }
        return;
      }

      // ── Selection ──────────────────────────────────────────────────────────
      if (matches(e, sc.selectAll)) { e.preventDefault(); q.selectAllJobs(); return; }
      if (matches(e, sc.deselect) || matches(e, sc.deselectAll)) { q.clearSelection(); return; }
      if (matches(e, sc.deleteSelected)) {
        if (q.selectedJobIds.length > 0) {
          e.preventDefault();
          // Locked jobs survive deletion
          q.setJobs(q.jobs.filter((j) => !q.selectedJobIds.includes(j.id) || q.lockedJobIds.includes(j.id)));
          q.clearSelection();
        }
        return;
      }
      if (matches(e, sc.lockSelected)) {
        if (q.selectedJobIds.length) q.lockJobs(q.selectedJobIds);
        return;
      }
      if (matches(e, sc.lockAll)) { q.lockAllJobs(); return; }

      // ── Navigation ────────────────────────────────────────────────────────
      if (matches(e, sc.audioTab)) { ui.setActiveTab('audio'); return; }
      if (matches(e, sc.videoTab)) { ui.setActiveTab('video'); return; }
      if (matches(e, sc.toggleSidebar)) { e.preventDefault(); ui.toggleSidebar(); return; }
      if (matches(e, sc.focusSearch)) { e.preventDefault(); ui.requestFocusSearch(); return; }
      if (matches(e, sc.browseFolder)) {
        e.preventDefault();
        const folder = await open({ directory: true, multiple: false, title: 'Select Output Folder' });
        if (typeof folder === 'string' && folder) await saveSettings({ outputFolder: folder });
        return;
      }

      // ── Window ────────────────────────────────────────────────────────────
      if (matches(e, sc.toggleFullscreen)) {
        const full = await win.isFullscreen();
        await win.setFullscreen(!full);
        return;
      }
      if (matches(e, sc.openSettings)) { e.preventDefault(); ui.toggleSettings(); return; }
      if (matches(e, sc.exit)) { await win.close(); return; }

      // ── Theme ─────────────────────────────────────────────────────────────
      if (matches(e, sc.themeDark)) { await saveSettings({ theme: 'dark' }); return; }
      if (matches(e, sc.themeLight)) { await saveSettings({ theme: 'light' }); return; }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
