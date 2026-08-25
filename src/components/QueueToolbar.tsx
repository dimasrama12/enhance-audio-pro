import { useEffect, useRef } from 'react';
import { Search, Trash2, LayoutList, LayoutGrid, Layers } from 'lucide-react';
import { clsx } from 'clsx';

import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import RecordButton from '@/components/RecordButton';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import type { AudioSubTab } from '@/stores/useUIStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  invokeProcessQueue,
  invokeConvertFiles,
  invokeArchiveJobs,
  invokeCancelJobs,
  invokeSetJobStatus,
  invokeSaveSettings,
} from '@/lib/ipc';
import { createLogger } from '@/lib/logger';
import type { ViewMode } from '@/stores/useQueueStore';
import type { QueueJob } from '@/types/queue';
import type { AppSettings } from '@/types/settings';

const log = createLogger('QueueToolbar');

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

// Tab pill labels (just tab names — action buttons live in QueueActionBar at the bottom)
const SUB_TAB_LABELS: Record<AudioSubTab, string> = {
  enhance: 'Enhance',
  convert: 'Convert',
};

export default function QueueToolbar(): JSX.Element {
  const enhancementStrength = useSettingsStore((s) => s.enhancementStrength);
  const hfDeHissDb = useSettingsStore((s) => s.hfDeHissDb);
  const setEnhancementStrength = useSettingsStore((s) => s.setEnhancementStrength);
  const setHfDeHissDb = useSettingsStore((s) => s.setHfDeHissDb);
  const filenameTemplateConverted = useSettingsStore((s) => s.filenameTemplateConverted);
  const focusSearchTick = useUIStore((s) => s.focusSearchTick);
  const activeTab = useUIStore((s) => s.activeTab);
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  const setAudioSubTab = useUIStore((s) => s.setAudioSubTab);
  const autoReEnhance = useUIStore((s) => s.autoReEnhance);
  const setAutoReEnhance = useUIStore((s) => s.setAutoReEnhance);

  // Per-tab state reads
  const filter = useQueueStore((s) => s.tabFilters[audioSubTab]);
  const searchQuery = useQueueStore((s) => s.tabSearches[audioSubTab]);
  const viewMode = useQueueStore((s) => s.tabViewModes[audioSubTab]);
  const groupByFormat = useQueueStore((s) => s.tabGroupByFormat[audioSubTab]);
  const selectedJobIds = useQueueStore((s) => s.tabSelectedIds[audioSubTab]);

  const { setFilter, setSearchQuery, setViewMode, setGroupByFormat } = useQueueStore();

  const searchRef = useRef<HTMLInputElement>(null);
  const abortProcessRef = useRef(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoReEnhanceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();
  const { addToast } = useToastStore();

  function scheduleAutoReEnhance(): void {
    if (autoReEnhanceDebounceRef.current) clearTimeout(autoReEnhanceDebounceRef.current);
    autoReEnhanceDebounceRef.current = setTimeout(() => {
      const { enhancementStrength: str, hfDeHissDb: hf, aiModel } = useSettingsStore.getState();
      const { tabQueues, jobVersionHistory, saveVersion, setUsedSettings } = useQueueStore.getState();
      const doneJobs = tabQueues['enhance'].filter((j) => j.status === 'done' && j.output_filepath);
      if (!doneJobs.length) return;

      doneJobs.forEach((job) => {
        const history = jobVersionHistory[job.id] ?? [];
        saveVersion(job.id, {
          versionIndex: history.length + 1,
          outputFilepath: job.output_filepath!,
          strength: job.usedStrength ?? str,
          hfDeHissDb: job.usedHfDeHissDb ?? (hf ?? -4),
          createdAt: Date.now(),
        });
        setUsedSettings(job.id, str, hf ?? -4);
        useQueueStore.getState().setStatus(job.id, 'queued');
        void invokeSetJobStatus(job.id, 'queued');
      });

      const freshJobs = useQueueStore.getState().tabQueues['enhance'];
      const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
      if (!isAnyProcessing) {
        const nextQueued = freshJobs.find((j) => j.status === 'queued');
        if (nextQueued) {
          invokeProcessQueue([nextQueued.id], str, aiModel, hf ?? -4).catch(console.error);
        }
      }
    }, 800);
  }

  function handleStrengthChange(value: number): void {
    setEnhancementStrength(value);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      const s = useSettingsStore.getState();
      void invokeSaveSettings(s as unknown as AppSettings);
    }, 500);
    if (autoReEnhance) scheduleAutoReEnhance();
  }

  function handleHfChange(value: number): void {
    setHfDeHissDb(value);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      const s = useSettingsStore.getState();
      void invokeSaveSettings(s as unknown as AppSettings);
    }, 500);
    if (autoReEnhance) scheduleAutoReEnhance();
  }

  useEffect(() => {
    if (focusSearchTick > 0) searchRef.current?.focus();
  }, [focusSearchTick]);



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
      const msg = i18n.t(
        activeJobs.length === 1 ? 'queue.confirmDeleteSingle' : 'queue.confirmDeleteMultiple',
        { count: activeJobs.length },
      );
      if (!window.confirm(msg)) return;
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
    const { tabQueues, tabImportingIds } = useQueueStore.getState();
    const tabJobs = tabQueues[tab];
    // Exclude rows still importing (dimmed placeholders) — they aren't in the DB yet.
    const importingIds = new Set(tabImportingIds[tab]);
    const enhIds = tabJobs
      .filter((j) => (j.status === 'pending' || j.status === 'error') && !importingIds.has(j.id))
      .map((j) => j.id);
    // Do NOT bail when something is already processing/queued: queue the rest so a
    // manual per-row run doesn't lock the global "Enhance All" action.
    if (!enhIds.length) return;

    abortProcessRef.current = false;
    const { setStatus } = useQueueStore.getState();
    const { aiModel } = useSettingsStore.getState();
    log.info(`Enhance All: queuing ${enhIds.length} job(s)`);
    enhIds.forEach((id) => setStatus(id, 'queued'));
    await Promise.all(enhIds.map((id) => invokeSetJobStatus(id, 'queued')));
    const freshJobs = useQueueStore.getState().tabQueues[tab];
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueued = freshJobs.find((j) => j.status === 'queued');
      if (nextQueued) {
        invokeProcessQueue([nextQueued.id], enhancementStrength, aiModel, useSettingsStore.getState().hfDeHissDb ?? -4).catch((err) => {
          console.error('Failed to auto-start queued job', err);
        });
      }
    }
  }

  async function handleCancelAll(): Promise<void> {
    abortProcessRef.current = true;
    // Cancel only the ACTIVE tab's jobs — the other tab's queue is untouched.
    const tab = useUIStore.getState().audioSubTab;
    const { tabQueues } = useQueueStore.getState();
    const activeIds = tabQueues[tab]
      .filter((j) => j.status === 'processing' || j.status === 'queued')
      .map((j) => j.id);
    log.info(`Cancel All [${tab}]: cancelling ${activeIds.length} active job(s)`);
    if (activeIds.length > 0) {
      try {
        await invokeCancelJobs(activeIds);
        addToast(`Cancelled ${activeIds.length} job${activeIds.length > 1 ? 's' : ''}`, 'info');
      } catch (err) {
        log.error('Cancel All failed', err);
      }
    }
  }



  async function handleConvert(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const { tabQueues, tabImportingIds } = useQueueStore.getState();
    const tabJobs = tabQueues[tab];
    const importingIds = new Set(tabImportingIds[tab]);
    const ids = tabJobs
      .filter((j) => j.status === 'pending' && !importingIds.has(j.id))
      .map((j) => j.id);
    // Queue the rest even while one is converting so per-row runs don't lock "Convert All".
    if (!ids.length) return;

    abortProcessRef.current = false;
    const { setStatus, setJobOperationMode } = useQueueStore.getState();
    log.info(`Convert All: queuing ${ids.length} job(s)`);
    ids.forEach((id) => { setJobOperationMode(id, 'convert', tab); setStatus(id, 'queued'); });
    await Promise.all(ids.map((id) => invokeSetJobStatus(id, 'queued')));
    const freshJobs = useQueueStore.getState().tabQueues[tab];
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueued = freshJobs.find((j) => j.status === 'queued');
      if (nextQueued) {
        invokeConvertFiles([nextQueued.id], filenameTemplateConverted).catch((err) => {
          console.error('Failed to auto-start convert job', err);
        });
      }
    }
  }

  // Register event listeners so QueueActionBar can trigger these handlers
  useEffect(() => {
    const onEnhance = (): void => { void handleProcess(); };
    const onConvert = (): void => { void handleConvert(); };
    const onCancelAll = (): void => { void handleCancelAll(); };
    window.addEventListener('action:enhance', onEnhance);
    window.addEventListener('action:convert', onConvert);
    window.addEventListener('queue:cancel-all', onCancelAll);
    return () => {
      window.removeEventListener('action:enhance', onEnhance);
      window.removeEventListener('action:convert', onConvert);
      window.removeEventListener('queue:cancel-all', onCancelAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



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
        {(['enhance', 'convert'] as const).map((tab) => {
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

      {/* ── Enhance-tab sliders + Auto toggle ── */}
      {audioSubTab === 'enhance' && (
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/[0.03] rounded-xl px-3 py-1.5 border border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium shrink-0 select-none">Str</span>
            <input
              type="range" min={0} max={100} step={1} value={enhancementStrength}
              onChange={(e) => handleStrengthChange(Number(e.target.value))}
              className="w-20 h-1 accent-violet-500 cursor-pointer"
              title={`Enhancement strength: ${enhancementStrength}%`}
            />
            <span className="text-[10px] text-slate-600 dark:text-zinc-300 tabular-nums w-7 text-right select-none">{enhancementStrength}%</span>
          </div>
          <div className="w-px h-3 bg-slate-300 dark:bg-white/[0.12] shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium shrink-0 select-none">HF</span>
            <input
              type="range" min={-12} max={0} step={0.5} value={hfDeHissDb ?? -4}
              onChange={(e) => handleHfChange(Number(e.target.value))}
              className="w-16 h-1 accent-violet-500 cursor-pointer"
              title={`HF de-hiss: ${hfDeHissDb ?? -4} dB`}
            />
            <span className="text-[10px] text-slate-600 dark:text-zinc-300 tabular-nums w-10 text-right select-none">
              {(hfDeHissDb ?? -4) > 0 ? '+' : ''}{hfDeHissDb ?? -4} dB
            </span>
          </div>
          <div className="w-px h-3 bg-slate-300 dark:bg-white/[0.12] shrink-0" />
          <button
            onClick={() => setAutoReEnhance(!autoReEnhance)}
            title={autoReEnhance ? 'Auto re-enhance ON — slider changes re-enhance done files' : 'Auto re-enhance OFF'}
            className={clsx(
              'px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 select-none',
              autoReEnhance
                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/30'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/[0.06]',
            )}
          >
            Auto
          </button>
        </div>
      )}

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
