import { useEffect, useRef, useState } from 'react';
import { Search, Trash2, RefreshCw, LayoutList, LayoutGrid, Layers } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import RecordButton from '@/components/RecordButton';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
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
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' }, { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, jobs, setOutputFormat, viewMode, setViewMode, groupByFormat, setGroupByFormat, selectedJobIds } =
    useQueueStore();
  const enhancementStrength = useSettingsStore((s) => s.enhancementStrength);
  const filenameTemplate = useSettingsStore((s) => s.filenameTemplate);
  const focusSearchTick = useUIStore((s) => s.focusSearchTick);
  const activeTab = useUIStore((s) => s.activeTab);
  const searchRef = useRef<HTMLInputElement>(null);
  const abortProcessRef = useRef(false);
  const prevIsAnyConvertingRef = useRef(false);
  const { t } = useTranslation();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (focusSearchTick > 0) searchRef.current?.focus();
  }, [focusSearchTick]);

  const [isSeparating, setIsSeparating] = useState(false);
  const [globalFormat, setGlobalFormat] = useState('wav');

  // "Enhance All" targets pending + error files — error files can be retried.
  // Separate / Convert only operate on strictly pending files.
  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const enhanceableIds = jobs.filter((j) => j.status === 'pending' || j.status === 'error').map((j) => j.id);

  // Distinguish active enhance vs convert batches via the operation-type map.
  const jobOperationTypes = useQueueStore((s) => s.jobOperationTypes);
  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'queued');
  const isAnyActive = activeJobs.length > 0;
  const isAnyConverting = activeJobs.some((j) => jobOperationTypes[j.id] === 'convert');
  const isAnyEnhancing = activeJobs.some((j) => jobOperationTypes[j.id] !== 'convert');
  const canEnhance = enhanceableIds.length > 0 && !isAnyActive;
  const canSeparate = pendingIds.length > 0 && !isSeparating && !isAnyActive;
  const canConvert = pendingIds.length > 0 && !isAnyActive;

  // Fire a completion toast (with "Download All") when a convert batch finishes.
  useEffect(() => {
    if (prevIsAnyConvertingRef.current && !isAnyConverting) {
      const { jobs: freshJobs, jobOperationTypes: freshTypes } = useQueueStore.getState();
      const convertDoneJobs = freshJobs.filter(
        (j) => j.status === 'done' && !!j.output_filepath && freshTypes[j.id] === 'convert',
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
        // 5-minute per-job timeout — prevents infinite hang if the sidecar
        // crashes or the callback POST silently fails.
        const timeoutId = setTimeout(() => {
          if (!settled) {
            log.warn(`Job ${id} timed out after 5 minutes — advancing queue`);
            settled = true; unlisten?.(); resolve();
          }
        }, 300_000);

        const settle = (): void => {
          if (!settled) { settled = true; clearTimeout(timeoutId); unlisten?.(); resolve(); }
        };

        listen<{ jobId: string; status: string }>('queue://status-change', (evt) => {
          if (!settled && evt.payload.jobId === id &&
            (evt.payload.status === 'done' || evt.payload.status === 'error' || evt.payload.status === 'pending')) {
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
    const { selectedJobIds, jobs, deleteJobs, lockedJobIds } = useQueueStore.getState();
    if (selectedJobIds.length === 0) return;

    const idsToDelete = selectedJobIds.filter((id) => !lockedJobIds.includes(id));
    if (idsToDelete.length === 0) return;

    const activeJobs = idsToDelete.map(id => jobs.find(j => j.id === id)).filter((j): j is QueueJob => j !== undefined && (j.status === 'processing' || j.status === 'queued'));
    if (activeJobs.length > 0) {
      const isIndonesian = useSettingsStore.getState().language === 'id';
      const fallbackMsg = isIndonesian
        ? (activeJobs.length === 1
            ? "Apakah Anda yakin ingin menghapus file ini? File ini sedang proses."
            : "Apakah Anda yakin ingin menghapus? File sedang diproses.")
        : (activeJobs.length === 1
            ? "Are you sure you want to delete this file? The file is currently being processed."
            : `Are you sure you want to delete ${activeJobs.length} files? Some files are currently being processed.`);
      if (!window.confirm(fallbackMsg)) return;
    }

    const activePlayerJobId = useUIStore.getState().activePlayerJobId;
    if (idsToDelete.includes(activePlayerJobId || '')) {
      useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
    }

    deleteJobs(idsToDelete);
    void invokeArchiveJobs(idsToDelete);
  }

  async function handleProcess(): Promise<void> {
    if (!canEnhance) return;
    abortProcessRef.current = false;
    const { setStatus } = useQueueStore.getState();
    const { aiModel } = useSettingsStore.getState();
    log.info(`Enhance All: queuing ${enhanceableIds.length} job(s)`);
    for (const id of enhanceableIds) {
      setStatus(id, 'queued');
      await invokeSetJobStatus(id, 'queued');
    }
    const freshJobs = useQueueStore.getState().jobs;
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueuedJob = freshJobs.find((j) => j.status === 'queued');
      if (nextQueuedJob) {
        invokeProcessQueue([nextQueuedJob.id], enhancementStrength, aiModel).catch((err) => {
          console.error('Failed to auto-start queued job', err);
        });
      }
    }
  }

  async function handleCancelAll(): Promise<void> {
    abortProcessRef.current = true;
    const { jobs } = useQueueStore.getState();
    const activeIds = jobs.filter(j => j.status === 'processing' || j.status === 'queued').map(j => j.id);
    log.info(`Cancel All: cancelling ${activeIds.length} active job(s)`);
    if (activeIds.length > 0) {
      try {
        await invokeCancelJobs(activeIds);
        addToast(`Cancelled ${activeIds.length} job${activeIds.length > 1 ? 's' : ''}`, 'info');
        log.info(`Cancel All: sent cancel signal for ${activeIds.length} job(s)`);
      } catch (err) {
        log.error('Cancel All failed', err);
      }
    }
  }

  useEffect(() => {
    const onCancelAll = (): void => {
      void handleCancelAll();
    };
    window.addEventListener('queue:cancel-all', onCancelAll);
    return () => window.removeEventListener('queue:cancel-all', onCancelAll);
  }, []);

  async function handleSeparate(): Promise<void> {
    if (!canSeparate) return;
    setIsSeparating(true);
    try { await runSequentially(pendingIds, (id) => invokeSeparateStems([id])); }
    finally { setIsSeparating(false); }
  }

  async function handleConvert(): Promise<void> {
    if (!canConvert) return;
    abortProcessRef.current = false;
    const { setStatus, setJobOperationMode } = useQueueStore.getState();
    log.info(`Convert All: queuing ${pendingIds.length} job(s)`);
    for (const id of pendingIds) {
      setJobOperationMode(id, 'convert');
      setStatus(id, 'queued');
      await invokeSetJobStatus(id, 'queued');
    }
    const freshJobs = useQueueStore.getState().jobs;
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueuedJob = freshJobs.find((j) => j.status === 'queued');
      if (nextQueuedJob) {
        invokeConvertFiles([nextQueuedJob.id], filenameTemplate).catch((err) => {
          console.error('Failed to auto-start convert job', err);
        });
      }
    }
  }

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
    const pendingJobs = jobs.filter((j) => j.status === 'pending');
    await Promise.all(
      pendingJobs.map((j) => {
        setOutputFormat(j.id, globalFormat);
        return invokeSetOutputFormat(j.id, globalFormat);
      })
    );
  }

  function toggleView(): void {
    const next: ViewMode = viewMode === 'table' ? 'grid' : 'table';
    setViewMode(next);
  }

  const ghostBtn = [
    'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium h-[32px] shrink-0',
    'transition-all duration-150',
    'bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300',
    'hover:bg-slate-300 dark:hover:bg-white/[0.10]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' ');

  const iconBtn = [
    'p-2 rounded-lg transition-colors duration-150',
    'text-slate-500 dark:text-zinc-100',
    'hover:text-slate-800 dark:hover:text-white',
    'hover:bg-slate-200 dark:hover:bg-white/[0.08]',
  ].join(' ');

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      {/* ── Left: Primary action buttons ── */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.03] rounded-xl px-1 py-1 border border-slate-200 dark:border-white/[0.06]">
        {/* Enhance All — always visible; disabled while a batch is running */}
        <button
          onClick={handleProcess}
          disabled={!canEnhance}
          title="Enhance speech [E]"
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium h-[28px] shrink-0 transition-all duration-150 bg-violet-600 hover:bg-violet-500 text-white shadow-glow-violet-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isAnyEnhancing ? 'Enhancing…' : 'Enhance All'}
        </button>
        <button
          onClick={handleConvert}
          disabled={!canConvert}
          title="Convert format [C]"
          className={`${ghostBtn} h-[28px]`}
        >
          {isAnyConverting ? 'Converting…' : 'Convert All'}
        </button>
        <button
          onClick={handleSeparate}
          disabled={!canSeparate}
          title="Separate stems [S]"
          className={`${ghostBtn} h-[28px]`}
        >
          {isSeparating ? 'Separating…' : 'Separate'}
        </button>
        {activeTab === 'audio' && <RecordButton />}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: Search, filter, format, icons ── */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-100 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder={t('toolbar.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-3 py-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-300 outline-none focus:ring-1 focus:ring-violet-500 transition w-44 border border-transparent focus:border-violet-500/30"
        />
      </div>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="bg-slate-200 dark:bg-white/[0.06] text-slate-800 dark:text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition border border-transparent"
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value} className="bg-white dark:bg-[#111827]">{f.label}</option>
        ))}
      </select>

      <div className="flex items-center gap-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-lg px-3 py-1.5 border border-transparent">
        <span className="text-slate-400 dark:text-zinc-100 text-xs font-medium">→</span>
        <select
          value={globalFormat}
          onChange={(e) => setGlobalFormat(e.target.value)}
          className="bg-transparent text-slate-800 dark:text-white text-xs outline-none"
        >
          {FORMAT_OPTIONS.map((f) => (
            <option key={f} value={f} className="bg-white dark:bg-[#111827]">{f.toUpperCase()}</option>
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

      <button onClick={toggleView} title={viewMode === 'table' ? t('toolbar.viewGrid') : t('toolbar.viewTable')} className={iconBtn}>
        {viewMode === 'table' ? <LayoutGrid size={16} /> : <LayoutList size={16} />}
      </button>
      <button
        onClick={() => setGroupByFormat(!groupByFormat)}
        title={groupByFormat ? 'Ungroup by format' : 'Group by format'}
        className={`p-2 rounded-lg transition-colors duration-150 ${groupByFormat
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
