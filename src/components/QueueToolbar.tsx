import { useEffect, useRef, useState } from 'react';
import { Search, Trash2, RefreshCw, LayoutList, LayoutGrid, Layers } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import RecordButton from '@/components/RecordButton';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import {
  invokeProcessQueue,
  invokeSeparateStems,
  invokeConvertFiles,
  invokeSetOutputFormat,
  invokeArchiveJobs,
} from '@/lib/ipc';
import type { ViewMode } from '@/stores/useQueueStore';

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
  const { t } = useTranslation();

  useEffect(() => {
    if (focusSearchTick > 0) searchRef.current?.focus();
  }, [focusSearchTick]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeparating, setIsSeparating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [globalFormat, setGlobalFormat] = useState('wav');

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const canEnhance = pendingIds.length > 0 && !isProcessing;
  const canSeparate = pendingIds.length > 0 && !isSeparating;
  const canConvert = pendingIds.length > 0 && !isConverting;

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
          if (!settled) { settled = true; unlisten?.(); resolve(); }
        }, 300_000);

        const settle = (): void => {
          if (!settled) { settled = true; clearTimeout(timeoutId); unlisten?.(); resolve(); }
        };

        listen<{ jobId: string; status: string }>('queue://status-change', (evt) => {
          if (!settled && evt.payload.jobId === id &&
            (evt.payload.status === 'done' || evt.payload.status === 'error')) {
            settle();
          }
        }).then((fn) => {
          unlisten = fn;
          if (!settled) invoke(id).catch(() => settle());
        });
      });
    }
  }

  async function handleDeleteSelected(): Promise<void> {
    const { selectedJobIds, deleteJobs, lockedJobIds } = useQueueStore.getState();
    if (selectedJobIds.length === 0) return;

    const idsToDelete = selectedJobIds.filter((id) => !lockedJobIds.includes(id));
    if (idsToDelete.length === 0) return;

    const activePlayerJobId = useUIStore.getState().activePlayerJobId;
    if (idsToDelete.includes(activePlayerJobId || '')) {
      useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
    }

    deleteJobs(idsToDelete);
    void invokeArchiveJobs(idsToDelete);
  }

  async function handleProcess(): Promise<void> {
    if (!canEnhance) return;
    setIsProcessing(true);
    try { await runSequentially(pendingIds, (id) => invokeProcessQueue([id], enhancementStrength)); }
    finally { setIsProcessing(false); }
  }

  async function handleSeparate(): Promise<void> {
    if (!canSeparate) return;
    setIsSeparating(true);
    try { await runSequentially(pendingIds, (id) => invokeSeparateStems([id])); }
    finally { setIsSeparating(false); }
  }

  async function handleConvert(): Promise<void> {
    if (!canConvert) return;
    setIsConverting(true);
    try { await runSequentially(pendingIds, (id) => invokeConvertFiles([id], filenameTemplate)); }
    finally { setIsConverting(false); }
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
    'text-slate-500 dark:text-white/40',
    'hover:text-slate-800 dark:hover:text-white',
    'hover:bg-slate-200 dark:hover:bg-white/[0.08]',
  ].join(' ');

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      {/* ── Left: Primary action buttons ── */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.03] rounded-xl px-1 py-1 border border-slate-200 dark:border-white/[0.06]">
        <button
          onClick={handleProcess}
          disabled={!canEnhance}
          title="Enhance speech [E]"
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium h-[28px] shrink-0 transition-all duration-150 bg-violet-600 hover:bg-violet-500 text-white shadow-glow-violet-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isProcessing ? 'Enhancing…' : 'Enhance All'}
        </button>
        <button
          onClick={handleSeparate}
          disabled={!canSeparate}
          title="Separate stems [S]"
          className={`${ghostBtn} h-[28px]`}
        >
          {isSeparating ? 'Separating…' : 'Separate'}
        </button>
        <button
          onClick={handleConvert}
          disabled={!canConvert}
          title="Convert format [C]"
          className={`${ghostBtn} h-[28px]`}
        >
          {isConverting ? 'Converting…' : 'Convert All'}
        </button>
        {activeTab === 'audio' && <RecordButton />}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right: Search, filter, format, icons ── */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder={t('toolbar.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-3 py-1.5 bg-slate-200 dark:bg-white/[0.06] rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/25 outline-none focus:ring-1 focus:ring-violet-500 transition w-44 border border-transparent focus:border-violet-500/30"
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
        <span className="text-slate-400 dark:text-white/30 text-xs font-medium">→</span>
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
          className="text-slate-400 dark:text-white/40 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-40 transition-colors"
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
        className="p-2 rounded-lg text-slate-400 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
