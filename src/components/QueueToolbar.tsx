import { useEffect, useRef } from 'react';
import { Search, Trash2, LayoutList, LayoutGrid, Layers, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';

import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import RecordButton from '@/components/RecordButton';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import type { AudioSubTab } from '@/stores/useUIStore';
import {
  invokeArchiveJobs,
  invokeSaveSettings,
} from '@/lib/ipc';
import type { ViewMode } from '@/stores/useQueueStore';
import type { QueueJob } from '@/types/queue';
import type { AppSettings } from '@/types/settings';

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
  const isLocked = useQueueStore((s) => s.tabQueues['enhance'].some((j) => j.status === 'processing' || j.status === 'queued'));
  const focusSearchTick = useUIStore((s) => s.focusSearchTick);
  const activeTab = useUIStore((s) => s.activeTab);
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  const setAudioSubTab = useUIStore((s) => s.setAudioSubTab);
  const isDraggingJob = useUIStore((s) => s.isDraggingJob);
  const crossTabDropTarget = useUIStore((s) => s.crossTabDropTarget);
  const setCrossTabDropTarget = useUIStore((s) => s.setCrossTabDropTarget);
  const tabPillRefs = useRef<Partial<Record<AudioSubTab, HTMLButtonElement>>>({});
  // Per-tab state reads
  const filter = useQueueStore((s) => s.tabFilters[audioSubTab]);
  const searchQuery = useQueueStore((s) => s.tabSearches[audioSubTab]);
  const viewMode = useQueueStore((s) => s.tabViewModes[audioSubTab]);
  const groupByFormat = useQueueStore((s) => s.tabGroupByFormat[audioSubTab]);
  const selectedJobIds = useQueueStore((s) => s.tabSelectedIds[audioSubTab]);

  const { setFilter, setSearchQuery, setViewMode, setGroupByFormat } = useQueueStore();

  const searchRef = useRef<HTMLInputElement>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  function handleStrengthChange(value: number): void {
    setEnhancementStrength(value);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      const s = useSettingsStore.getState();
      void invokeSaveSettings(s as unknown as AppSettings);
    }, 500);
  }

  function handleHfChange(value: number): void {
    setHfDeHissDb(value);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      const s = useSettingsStore.getState();
      void invokeSaveSettings(s as unknown as AppSettings);
    }, 500);
  }

  useEffect(() => {
    if (focusSearchTick > 0) searchRef.current?.focus();
  }, [focusSearchTick]);

  // P2-D: track pointer position over inactive tab pill while a job is being dragged
  useEffect(() => {
    if (!isDraggingJob) {
      setCrossTabDropTarget(null);
      return;
    }
    const handleMove = (e: PointerEvent): void => {
      let found: AudioSubTab | null = null;
      for (const tab of (['enhance', 'convert'] as const)) {
        if (tab === audioSubTab) continue;
        const el = tabPillRefs.current[tab];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          found = tab;
          break;
        }
      }
      setCrossTabDropTarget(found);
    };
    document.addEventListener('pointermove', handleMove);
    return () => document.removeEventListener('pointermove', handleMove);
  }, [isDraggingJob, audioSubTab, setCrossTabDropTarget]);



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
          const isDragTarget = isDraggingJob && !isActive && crossTabDropTarget === tab;
          return (
            <button
              key={tab}
              ref={(el) => { if (el) tabPillRefs.current[tab] = el; }}
              onClick={() => setAudioSubTab(tab)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium h-[28px] transition-all duration-150 flex items-center gap-1',
                isActive
                  ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/[0.10]'
                  : isDragTarget
                  ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 ring-1 ring-violet-400/50 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06]',
              )}
            >
              {isDragTarget && <ArrowRightLeft size={10} className="shrink-0" />}
              {SUB_TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {/* ── Enhance-tab sliders ── */}
      {audioSubTab === 'enhance' && (
        <div
          className={clsx(
            'flex items-center gap-3 rounded-xl px-3 py-1.5 border transition-opacity duration-200',
            isLocked
              ? 'bg-slate-100/60 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/[0.04] opacity-45 pointer-events-none cursor-not-allowed'
              : 'bg-slate-100 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06]',
          )}
          title={isLocked ? 'Parameters locked while processing' : undefined}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium shrink-0 select-none">Str</span>
            <input
              type="range" min={0} max={100} step={1} value={enhancementStrength}
              onChange={(e) => handleStrengthChange(Number(e.target.value))}
              disabled={isLocked}
              className={clsx('w-20 h-1', isLocked ? 'accent-slate-400 cursor-not-allowed' : 'accent-violet-500 cursor-pointer')}
              title={isLocked ? 'Locked while processing' : `Enhancement strength: ${enhancementStrength}%`}
            />
            <span className="text-[10px] text-slate-600 dark:text-zinc-300 tabular-nums w-7 text-right select-none">{enhancementStrength}%</span>
          </div>
          <div className="w-px h-3 bg-slate-300 dark:bg-white/[0.12] shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium shrink-0 select-none">HF</span>
            <input
              type="range" min={-12} max={0} step={0.5} value={hfDeHissDb ?? -4}
              onChange={(e) => handleHfChange(Number(e.target.value))}
              disabled={isLocked}
              className={clsx('w-16 h-1', isLocked ? 'accent-slate-400 cursor-not-allowed' : 'accent-violet-500 cursor-pointer')}
              title={isLocked ? 'Locked while processing' : `HF de-hiss: ${hfDeHissDb ?? -4} dB`}
            />
            <span className="text-[10px] text-slate-600 dark:text-zinc-300 tabular-nums w-10 text-right select-none">
              {(hfDeHissDb ?? -4) > 0 ? '+' : ''}{hfDeHissDb ?? -4} dB
            </span>
          </div>
          {isLocked && (
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 shrink-0 select-none tracking-wide">locked</span>
          )}
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
