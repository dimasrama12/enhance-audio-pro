import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { useAudioPlayer } from '@/stores/useAudioPlayer';
import {
  invokeListFolderFiles,
  invokeConvertFiles,
  invokeProcessQueue,
  invokeSeparateStems,
  invokeSaveSettings,
  invokeArchiveJobs,
} from '@/lib/ipc';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/types/settings';
import type { AppSettings } from '@/types/settings';
import { handleImportFiles } from '@/lib/importHelper';


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
      // Prevent browser reload / refresh shortcuts
      if (
        e.key === 'F5' ||
        (e.ctrlKey && e.key.toLowerCase() === 'r') ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r')
      ) {
        e.preventDefault();
        window.location.reload();
        return;
      }

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
          recordingPrefix: s.recordingPrefix ?? 'Record',
          aiModel: s.aiModel ?? 'deepfilternet',
          ...patch,
        };
        s.setSettings(next);
        await invokeSaveSettings(next);
      };

      // ── Playback / Focus separation ───────────────────────────────────────
      const isPlayerFocused = !!document.activeElement?.closest('.waveform-player-container');
      const isPlayerOpen = ui.playerOpen;

      if (isPlayerOpen && (e.key === ' ' || e.key === 'Shift')) {
        return;
      }

      if (isPlayerFocused) {
        const isUnmodified = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
        if (isUnmodified && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'j')) {
          return;
        }
      }

      // ── Playback ──────────────────────────────────────────────────────────
      if (e.key === ' ') {
        e.preventDefault();
        const primaryId = q.primarySelectedId();
        if (primaryId) {
          const job = q.jobs.find((j) => j.id === primaryId);
          if (job) {
            const src = job.ab_mode === 'enhanced' && job.output_filepath
              ? job.output_filepath
              : job.filepath;
            useAudioPlayer.getState().toggle(primaryId, src);
          }
        }
        return;
      }

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
          await handleImportFiles(paths);
        }
        return;
      }

      // ── Selection ──────────────────────────────────────────────────────────
      if (matches(e, sc.selectAll)) { e.preventDefault(); q.selectAllJobs(); return; }
      if (matches(e, sc.deselect) || matches(e, sc.deselectAll)) { q.clearSelection(); return; }
      if (matches(e, sc.deleteSelected)) {
        if (q.selectedJobIds.length > 0) {
          e.preventDefault();
          const idsToDelete = q.selectedJobIds.filter((id) => !q.lockedJobIds.includes(id));
          if (idsToDelete.length > 0) {
            const activeJobs = idsToDelete.map(id => q.jobs.find(j => j.id === id)).filter((j): j is typeof q.jobs[0] => j !== undefined && (j.status === 'processing' || j.status === 'queued'));
            if (activeJobs.length > 0) {
              const isIndonesian = useSettingsStore.getState().language === 'id';
              const fallbackMsg = isIndonesian
                ? (activeJobs.length === 1
                    ? `Apakah Anda yakin ingin menghapus "${activeJobs[0].filename}"? File sedang diproses.`
                    : `Apakah Anda yakin ingin menghapus ${activeJobs.length} file? Beberapa file sedang diproses.`)
                : (activeJobs.length === 1
                    ? `Are you sure you want to delete "${activeJobs[0].filename}"? The file is currently being processed.`
                    : `Are you sure you want to delete ${activeJobs.length} files? Some files are currently being processed.`);
              if (!window.confirm(fallbackMsg)) {
                return;
              }
            }
            const activePlayerJobId = ui.activePlayerJobId;
            if (activePlayerJobId && idsToDelete.includes(activePlayerJobId)) {
              useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
            }
            void invokeArchiveJobs(idsToDelete);
            q.deleteJobs(idsToDelete);
          }
        }
        return;
      }
      if (e.key === 'L' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const allLocked = q.jobs.length > 0 && q.jobs.every((j) => q.lockedJobIds.includes(j.id));
        if (allLocked) q.unlockJobs(q.jobs.map((j) => j.id));
        else q.lockJobs(q.jobs.map((j) => j.id));
        return;
      }
      if (matches(e, sc.lockSelected) || (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        if (q.selectedJobIds.length) {
          const allLocked = q.selectedJobIds.every((id) => q.lockedJobIds.includes(id));
          if (allLocked) q.unlockJobs(q.selectedJobIds);
          else q.lockJobs(q.selectedJobIds);
        }
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
        const folder = await open({ directory: true, multiple: false, title: 'Import Files from Folder' });
        if (typeof folder === 'string' && folder) {
          const listRes = await invokeListFolderFiles(folder);
          if (listRes.success && listRes.data && listRes.data.length > 0) {
            await handleImportFiles(listRes.data);
          }
        }
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

      // ── View ──────────────────────────────────────────────────────────────
      if (matches(e, sc.tableView)) { q.setViewMode('table'); return; }
      if (matches(e, sc.gridView)) { q.setViewMode('grid'); return; }

      // ── History ───────────────────────────────────────────────────────────
      if (matches(e, sc.openHistory)) { e.preventDefault(); ui.toggleHistory(); return; }

      // ── Close Player ──────────────────────────────────────────────────────
      if (matches(e, sc.closePlayer) || (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        ui.setPlayerOpen(false);
        return;
      }

      // ── Theme ─────────────────────────────────────────────────────────────
      if (matches(e, sc.themeDark)) { await saveSettings({ theme: 'dark' }); return; }
      if (matches(e, sc.themeLight)) { await saveSettings({ theme: 'light' }); return; }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
