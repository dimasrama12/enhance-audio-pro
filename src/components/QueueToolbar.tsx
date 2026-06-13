import { useEffect, useRef, useState } from 'react';
import { Search, Trash2, RefreshCw, LayoutList, LayoutGrid, Layers } from 'lucide-react';
import { clsx } from 'clsx';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import RecordButton from '@/components/RecordButton';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import type { AudioSubTab } from '@/stores/useUIStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  invokeProcessQueue,
  invokeSeparateStems,
  invokeConvertFiles,
  invokeSetOutputFormat,
  invokeArchiveJobs,
  invokeCancelJobs,
  invokeSetJobStatus,
  invokeCopyEnhancedFile,
} from '@/lib/ipc';
import { createLogger } from '@/lib/logger';
import type { ViewMode } from '@/stores/useQueueStore';
import type { QueueJob } from '@/types/queue';

const log = createLogger('QueueToolbar');

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];

// Tab pill labels (just tab names — action buttons live in QueueActionBar at the bottom)
const SUB_TAB_LABELS: Record<AudioSubTab, string> = {
  enhance: 'Enhance',
  convert: 'Convert',
  separate: 'Separate',
};

export default function QueueToolbar(): JSX.Element {
  const enhancementStrength = useSettingsStore((s) => s.enhancementStrength);
  const filenameTemplate = useSettingsStore((s) => s.filenameTemplate);
  const focusSearchTick = useUIStore((s) => s.focusSearchTick);
  const activeTab = useUIStore((s) => s.activeTab);
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  const setAudioSubTab = useUIStore((s) => s.setAudioSubTab);

  // Per-tab state reads
  const filter = useQueueStore((s) => s.tabFilters[audioSubTab]);
  const searchQuery = useQueueStore((s) => s.tabSearches[audioSubTab]);
  const jobs = useQueueStore((s) => s.tabQueues[audioSubTab]);
  const viewMode = useQueueStore((s) => s.tabViewModes[audioSubTab]);
  const groupByFormat = useQueueStore((s) => s.tabGroupByFormat[audioSubTab]);
  const selectedJobIds = useQueueStore((s) => s.tabSelectedIds[audioSubTab]);
  const jobOperationTypes = useQueueStore((s) => s.tabJobOpTypes[audioSubTab]);

  const { setFilter, setSearchQuery, setOutputFormat, setViewMode, setGroupByFormat } = useQueueStore();

  const searchRef = useRef<HTMLInputElement>(null);
  const abortProcessRef = useRef(false);
  const prevIsAnyConvertingRef = useRef(false);
  const { t } = useTranslation();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (focusSearchTick > 0) searchRef.current?.focus();
  }, [focusSearchTick]);

  const [globalFormat, setGlobalFormat] = useState('wav');

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'queued');
  const isAnyConverting = activeJobs.some((j) => jobOperationTypes[j.id] === 'convert');

  // Fire "Download All" toast when a convert batch finishes
  useEffect(() => {
    if (prevIsAnyConvertingRef.current && !isAnyConverting) {
      const freshOpTypes = useQueueStore.getState().tabJobOpTypes[audioSubTab];
      const freshJobs = useQueueStore.getState().tabQueues[audioSubTab];
      const convertDoneJobs = freshJobs.filter(
        (j) => j.status === 'done' && !!j.output_filepath && freshOpTypes[j.id] === 'convert',
      );
      if (convertDoneJobs.length > 0) {
        addToast(
          `${convertDoneJobs.length} file${convertDoneJobs.length > 1 ? 's' : ''} converted`,
          'success',
          {
            label: 'Download All',
            onClick: () => void triggerConvertDownloadAll(convertDoneJobs),
          },
          8000,
        );
      }
    }
    prevIsAnyConvertingRef.current = isAnyConverting;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnyConverting]);

  async function runSequentially(
    ids: string[],
    invoke: (id: string) => Promise<unknown>,
  ): Promise<void> {
    for (const id of ids) {
      await new Promise<void>((resolve) => {
        let settled = false;
        let unlisten: (() => void) | undefined;
        const timeoutId = setTimeout(() => {
          if (!settled) {
            log.warn(`Job ${id} timed out after 5 minutes — advancing queue`);
            settled = true;
            unlisten?.();
            resolve();
          }
        }, 300_000);

        const settle = (): void => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            unlisten?.();
            resolve();
          }
        };

        listen<{ jobId: string; status: string }>('queue://status-change', (evt) => {
          if (
            !settled &&
            evt.payload.jobId === id &&
            (evt.payload.status === 'done' ||
              evt.payload.status === 'error' ||
              evt.payload.status === 'pending')
          ) {
            log.info(`Job ${id} settled with status: ${evt.payload.status}`);
            settle();
          }
        }).then((fn) => {
          unlisten = fn;
          if (!settled && !abortProcessRef.current) {
            log.info(`Dispatching job ${id}`);
            invoke(id).catch(() => settle());
          } else {
            settle();
          }
        });
      });
      if (abortProcessRef.current) break;
    }
  }

  async function handleDeleteSelected(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const { tabSelectedIds, tabQueues, deleteJobs, tabLockedIds } = useQueueStore.getState();
    const selectedIds = tabSelectedIds[tab];
    if (selectedIds.length === 0) return;

    const lockedIds = tabLockedIds[tab];
    const idsToDelete = selectedIds.filter((id) => !lockedIds.includes(id));
    if (idsToDelete.length === 0) return;

    const tabJobs = tabQueues[tab];
    const activeJobs = idsToDelete
      .map((id) => tabJobs.find((j) => j.id === id))
      .filter(
        (j): j is QueueJob =>
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

    const activePlayerJobId = useUIStore.getState().activePlayerJobId;
    if (idsToDelete.includes(activePlayerJobId || '')) {
      useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
    }

    deleteJobs(idsToDelete, tab);
    void invokeArchiveJobs(idsToDelete);
  }

  async function handleProcess(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const tabJobs = useQueueStore.getState().tabQueues[tab];
    const enhIds = tabJobs.filter((j) => j.status === 'pending' || j.status === 'error').map((j) => j.id);
    const isActive = tabJobs.some((j) => j.status === 'processing' || j.status === 'queued');
    if (!enhIds.length || isActive) return;

    abortProcessRef.current = false;
    const { setStatus } = useQueueStore.getState();
    const { aiModel } = useSettingsStore.getState();
    log.info(`Enhance All: queuing ${enhIds.length} job(s)`);
    for (const id of enhIds) {
      setStatus(id, 'queued');
      await invokeSetJobStatus(id, 'queued');
    }
    const freshJobs = useQueueStore.getState().tabQueues[tab];
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueued = freshJobs.find((j) => j.status === 'queued');
      if (nextQueued) {
        invokeProcessQueue([nextQueued.id], enhancementStrength, aiModel).catch((err) => {
          console.error('Failed to auto-start queued job', err);
        });
      }
    }
  }

  async function handleCancelAll(): Promise<void> {
    abortProcessRef.current = true;
    // Cancel across ALL tabs
    const { tabQueues } = useQueueStore.getState();
    const activeIds = (['enhance', 'convert', 'separate'] as const).flatMap((t) =>
      tabQueues[t].filter((j) => j.status === 'processing' || j.status === 'queued').map((j) => j.id),
    );
    log.info(`Cancel All: cancelling ${activeIds.length} active job(s)`);
    if (activeIds.length > 0) {
      try {
        await invokeCancelJobs(activeIds);
        addToast(`Cancelled ${activeIds.length} job${activeIds.length > 1 ? 's' : ''}`, 'info');
      } catch (err) {
        log.error('Cancel All failed', err);
      }
    }
  }

  async function handleSeparate(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const tabJobs = useQueueStore.getState().tabQueues[tab];
    const ids = tabJobs.filter((j) => j.status === 'pending').map((j) => j.id);
    const isActive = tabJobs.some((j) => j.status === 'processing' || j.status === 'queued');
    if (!ids.length || useUIStore.getState().isSeparating || isActive) return;
    useUIStore.getState().setIsSeparating(true);
    try {
      await runSequentially(ids, (id) => invokeSeparateStems([id]));
    } finally {
      useUIStore.getState().setIsSeparating(false);
    }
  }

  async function handleConvert(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const tabJobs = useQueueStore.getState().tabQueues[tab];
    const ids = tabJobs.filter((j) => j.status === 'pending').map((j) => j.id);
    const isActive = tabJobs.some((j) => j.status === 'processing' || j.status === 'queued');
    if (!ids.length || isActive) return;

    abortProcessRef.current = false;
    const { setStatus, setJobOperationMode } = useQueueStore.getState();
    log.info(`Convert All: queuing ${ids.length} job(s)`);
    for (const id of ids) {
      setJobOperationMode(id, 'convert', tab);
      setStatus(id, 'queued');
      await invokeSetJobStatus(id, 'queued');
    }
    const freshJobs = useQueueStore.getState().tabQueues[tab];
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueued = freshJobs.find((j) => j.status === 'queued');
      if (nextQueued) {
        invokeConvertFiles([nextQueued.id], filenameTemplate).catch((err) => {
          console.error('Failed to auto-start convert job', err);
        });
      }
    }
  }

  // Register event listeners so QueueActionBar can trigger these handlers
  useEffect(() => {
    const onEnhance = (): void => { void handleProcess(); };
    const onConvert = (): void => { void handleConvert(); };
    const onSeparate = (): void => { void handleSeparate(); };
    const onCancelAll = (): void => { void handleCancelAll(); };
    window.addEventListener('action:enhance', onEnhance);
    window.addEventListener('action:convert', onConvert);
    window.addEventListener('action:separate', onSeparate);
    window.addEventListener('queue:cancel-all', onCancelAll);
    return () => {
      window.removeEventListener('action:enhance', onEnhance);
      window.removeEventListener('action:convert', onConvert);
      window.removeEventListener('action:separate', onSeparate);
      window.removeEventListener('queue:cancel-all', onCancelAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerConvertDownloadAll(doneJobs: QueueJob[]): Promise<void> {
    const folder = await openDialog({ directory: true, multiple: false, title: 'Select Download Folder' });
    if (typeof folder !== 'string' || !folder) return;
    const sep = folder.includes('\\') ? '\\' : '/';
    let count = 0;
    for (const job of doneJobs) {
      if (!job.output_filepath) continue;
      const filename = job.output_filepath.replace(/\\/g, '/').split('/').pop() ?? job.filename;
      const destPath = `${folder}${sep}${filename}`;
      const res = await invokeCopyEnhancedFile(job.id, job.output_filepath, destPath);
      if (res.success) {
        useQueueStore.getState().setDownloadPath(job.id, destPath);
        count++;
      }
    }
    addToast(`Downloaded ${count} converted file${count !== 1 ? 's' : ''} to ${folder}`, 'success');
  }

  async function handleApplyFormat(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const tabJobs = useQueueStore.getState().tabQueues[tab];
    const pendingJobs = tabJobs.filter((j) => j.status === 'pending');
    await Promise.all(
      pendingJobs.map((j) => {
        setOutputFormat(j.id, globalFormat);
        return invokeSetOutputFormat(j.id, globalFormat);
      }),
    );
  }

  function toggleView(): void {
    const next: ViewMode = viewMode === 'table' ? 'grid' : 'table';
    setViewMode(next, audioSubTab);
  }

  const iconBtn = [
    'p-2 rounded-lg transition-colors duration-150',
    'text-slate-500 dark:text-zinc-100',
    'hover:text-slate-800 dark:hover:text-white',
    'hover:bg-slate-200 dark:hover:bg-white/[0.08]',
  ].join(' ');

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      {/* ── Left: Sub-tab navigation pills only ── */}
      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white/[0.03] rounded-xl px-1 py-1 border border-slate-200 dark:border-white/[0.06]">
        {(['enhance', 'convert', 'separate'] as const).map((tab) => {
          const isActive = audioSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setAudioSubTab(tab)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium h-[28px] transition-all duration-150',
                isActive
                  ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/[0.10]'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06]',
              )}
            >
              {SUB_TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: Record, Search, filter, format, icons ── */}
      {activeTab === 'audio' && <RecordButton />}

      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-100 pointer-events-none"
        />
        <input
          ref={searchRef}
          type="text"
          placeholder={t('toolbar.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value, audioSubTab)}
          className="pl-8 pr-3 py-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-300 outline-none focus:ring-1 focus:ring-violet-500 transition w-44 border border-transparent focus:border-violet-500/30"
        />
      </div>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value, audioSubTab)}
        className="bg-slate-200 dark:bg-white/[0.06] text-slate-800 dark:text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition border border-transparent"
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value} className="bg-white dark:bg-[#111827]">
            {f.label}
          </option>
        ))}
      </select>

      {audioSubTab !== 'enhance' && (
        <div className="flex items-center gap-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-lg px-3 py-1.5 border border-transparent">
          <span className="text-slate-400 dark:text-zinc-100 text-xs font-medium">→</span>
          <select
            value={globalFormat}
            onChange={(e) => setGlobalFormat(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-white text-xs outline-none"
          >
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f} className="bg-white dark:bg-[#111827]">
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            onClick={handleApplyFormat}
            disabled={pendingIds.length === 0}

            title={t('toolbar.applyFormat')}
            className="text-slate-400 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      <button
        onClick={toggleView}
        title={viewMode === 'table' ? t('toolbar.viewGrid') : t('toolbar.viewTable')}
        className={iconBtn}
      >
        {viewMode === 'table' ? <LayoutGrid size={16} /> : <LayoutList size={16} />}
      </button>

      <button
        onClick={() => setGroupByFormat(!groupByFormat, audioSubTab)}
        title={groupByFormat ? 'Ungroup by format' : 'Group by format'}
        className={`p-2 rounded-lg transition-colors duration-150 ${
          groupByFormat
            ? 'text-violet-500 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/15'
            : iconBtn
        }`}
      >
        <Layers size={16} />
      </button>

      <button
        onClick={handleDeleteSelected}
        disabled={selectedJobIds.length === 0}
        title={t('toolbar.deleteSelected', 'Delete selected')}
        className="p-2 rounded-lg text-slate-400 dark:text-zinc-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
