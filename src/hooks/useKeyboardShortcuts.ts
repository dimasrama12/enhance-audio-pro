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
  invokeSetJobStatus,
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
      const tab = ui.audioSubTab;
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

      const isPlayerFocused = !!document.activeElement?.closest('.waveform-player-container');
      const isPlayerOpen = ui.playerOpen;

      if (isPlayerOpen && (e.key === ' ' || e.key === 'Shift')) return;

      if (isPlayerFocused) {
        const isUnmodified = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
        if (isUnmodified && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'j')) return;
      }

      // ── Playback ──────────────────────────────────────────────────────────
      if (e.key === ' ') {
        e.preventDefault();
        const primaryId = q.primarySelectedId(tab);
        if (primaryId) {
          const job = q.getJobById(primaryId);
          if (job) {
            const src =
              job.ab_mode === 'enhanced' && job.output_filepath
                ? job.output_filepath
                : job.filepath;
            useAudioPlayer.getState().toggle(primaryId, src);
          }
        }
        return;
      }

      // ── Queue actions ──────────────────────────────────────────────────────
      if (matches(e, sc.enhance)) {
        const tabJobs = q.tabQueues[tab];
        const enhIds = tabJobs.filter((j) => j.status === 'pending' || j.status === 'error').map((j) => j.id);
        const isActive = tabJobs.some((j) => j.status === 'processing' || j.status === 'queued');
        if (!enhIds.length || isActive) return;
        for (const id of enhIds) {
          q.setStatus(id, 'queued');
          await invokeSetJobStatus(id, 'queued');
        }
        const freshJobs = useQueueStore.getState().tabQueues[tab];
        const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
        if (!isAnyProcessing) {
          const nextQueued = freshJobs.find((j) => j.status === 'queued');
          if (nextQueued) {
            invokeProcessQueue([nextQueued.id], s.enhancementStrength, s.aiModel ?? 'deepfilternet').catch(
              console.error,
            );
          }
        }
        return;
      }

      if (matches(e, sc.separate)) {
        const ids = q.tabQueues[tab].filter((j) => j.status === 'pending').map((j) => j.id);
        if (ids.length) invokeSeparateStems(ids);
        return;
      }

      if (matches(e, sc.convert)) {
        const tabJobs = q.tabQueues[tab];
        const ids = tabJobs.filter((j) => j.status === 'pending').map((j) => j.id);
        const isActive = tabJobs.some((j) => j.status === 'processing' || j.status === 'queued');
        if (!ids.length || isActive) return;
        for (const id of ids) {
          q.setJobOperationMode(id, 'convert', tab);
          q.setStatus(id, 'queued');
          await invokeSetJobStatus(id, 'queued');
        }
        const freshJobs = useQueueStore.getState().tabQueues[tab];
        const nextQueued = freshJobs.find((j) => j.status === 'queued');
        if (nextQueued) {
          invokeConvertFiles([nextQueued.id], s.filenameTemplate).catch(console.error);
        }
        return;
      }

      if (matches(e, sc.openFiles)) {
        e.preventDefault();
        const selected = await open({
          multiple: true,
          filters: [
            {
              name: 'Audio / Video',
              extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'm4a', 'wma', 'mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'],
            },
          ],
        });
        const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        if (paths.length) await handleImportFiles(paths);
        return;
      }

      // ── Selection ──────────────────────────────────────────────────────────
      if (matches(e, sc.selectAll)) { e.preventDefault(); q.selectAllJobs(tab); return; }
      if (matches(e, sc.deselect) || matches(e, sc.deselectAll)) { q.clearSelection(tab); return; }

      if (matches(e, sc.deleteSelected)) {
        const selectedIds = q.tabSelectedIds[tab];
        if (selectedIds.length > 0) {
          e.preventDefault();
          const lockedIds = q.tabLockedIds[tab];
          const idsToDelete = selectedIds.filter((id) => !lockedIds.includes(id));
          if (idsToDelete.length > 0) {
            const tabJobs = q.tabQueues[tab];
            const activeJobs = idsToDelete
              .map((id) => tabJobs.find((j) => j.id === id))
              .filter(
                (j): j is (typeof tabJobs)[0] =>
                  j !== undefined && (j.status === 'processing' || j.status === 'queued'),
              );
            if (activeJobs.length > 0) {
              const isIndonesian = useSettingsStore.getState().language === 'id';
              const fallbackMsg = isIndonesian
                ? activeJobs.length === 1
                  ? 'Apakah Anda yakin ingin menghapus file ini? File ini sedang proses.'
                  : 'Apakah Anda yakin ingin menghapus? File sedang diproses.'
                : activeJobs.length === 1
                ? 'Are you sure you want to delete this file? The file is currently being processed.'
                : `Are you sure you want to delete ${activeJobs.length} files? Some files are currently being processed.`;
              if (!window.confirm(fallbackMsg)) return;
            }
            const activePlayerJobId = ui.activePlayerJobId;
            if (activePlayerJobId && idsToDelete.includes(activePlayerJobId)) {
              useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
            }
            void invokeArchiveJobs(idsToDelete);
            q.deleteJobs(idsToDelete, tab);
          }
        }
        return;
      }

      // ── Lock ──────────────────────────────────────────────────────────────
      if (e.key === 'L' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabJobs = q.tabQueues[tab];
        const lockedIds = q.tabLockedIds[tab];
        const allLocked = tabJobs.length > 0 && tabJobs.every((j) => lockedIds.includes(j.id));
        if (allLocked) q.unlockJobs(tabJobs.map((j) => j.id), tab);
        else q.lockJobs(tabJobs.map((j) => j.id), tab);
        return;
      }

      if (matches(e, sc.lockSelected) || (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        const selectedIds = q.tabSelectedIds[tab];
        if (selectedIds.length) {
          const lockedIds = q.tabLockedIds[tab];
          const allLocked = selectedIds.every((id) => lockedIds.includes(id));
          if (allLocked) q.unlockJobs(selectedIds, tab);
          else q.lockJobs(selectedIds, tab);
        }
        return;
      }

      if (matches(e, sc.lockAll)) { q.lockAllJobs(tab); return; }

      // ── Navigation ────────────────────────────────────────────────────────
      if (matches(e, sc.audioTab)) { ui.setActiveTab('audio'); return; }
      if (matches(e, sc.videoTab)) { ui.setActiveTab('video'); return; }
      if (matches(e, sc.toggleSidebar)) { e.preventDefault(); ui.toggleSidebar(); return; }
      if (matches(e, sc.focusSearch)) { e.preventDefault(); ui.requestFocusSearch(); return; }

      // ── Sub-tab switch (1 / 2 / 3) ────────────────────────────────────────
      if (matches(e, sc.tabEnhance)) { ui.setAudioSubTab('enhance'); return; }
      if (matches(e, sc.tabConvert)) { ui.setAudioSubTab('convert'); return; }
      if (matches(e, sc.tabSeparate)) { ui.setAudioSubTab('separate'); return; }

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

      // ── View (Shift+1 / Shift+2) ──────────────────────────────────────────
      if (matches(e, sc.tableView)) { q.setViewMode('table', tab); return; }
      if (matches(e, sc.gridView)) { q.setViewMode('grid', tab); return; }

      // ── History ───────────────────────────────────────────────────────────
      if (matches(e, sc.openHistory)) { e.preventDefault(); ui.toggleHistory(); return; }

      // ── Close Player ──────────────────────────────────────────────────────
      if (
        matches(e, sc.closePlayer) ||
        (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
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
