import React, { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { GripVertical, Play, Pause, FolderOpen, Lock, ChevronRight, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueueStore } from '@/stores/useQueueStore';
import { useUIStore } from '@/stores/useUIStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAudioPlayer } from '@/stores/useAudioPlayer';
import { invokeSetOutputFormat, invokeSetBitrate, invokeSetSampleRate, invokeArchiveJobs } from '@/lib/ipc';
import type { QueueJob, JobStatus } from '@/types/queue';

// ─── Resize handle ────────────────────────────────────────────────────────────

interface ResizeHandleProps { onDelta: (delta: number) => void; }

function ResizeHandle({ onDelta }: ResizeHandleProps): JSX.Element {
  function onMouseDown(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    let lastX = e.clientX;
    const onMove = (ev: MouseEvent): void => { onDelta(ev.clientX - lastX); lastX = ev.clientX; };
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  return <div className="resize-handle" onMouseDown={onMouseDown} />;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE_CLS: Record<JobStatus, string> = {
  pending: 'bg-slate-400/10 text-slate-500 dark:text-slate-400',
  processing: 'bg-amber-400/10 text-amber-600 dark:text-amber-400',
  done: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'bg-red-500/10 text-red-500 dark:text-red-400',
};

function StatusBadge({ status, progress, errorMessage }: {
  status: JobStatus;
  progress: number;
  errorMessage?: string | null;
}): JSX.Element {
  return (
    <div>
      <span
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
          STATUS_BADGE_CLS[status],
        )}
        title={status === 'error' ? (errorMessage ?? undefined) : undefined}
      >
        {status === 'processing' && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 status-processing-dot shrink-0" />
        )}
        {status}
      </span>
      {status === 'processing' && (
        <div className="mt-1.5 h-[3px] w-full rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];
const BITRATE_OPTIONS = ['', '64k', '96k', '128k', '192k', '256k', '320k'];
const SAMPLE_RATE_OPTIONS = ['', '22050', '44100', '48000', '96000'];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

const selectCls = 'bg-slate-100 dark:bg-white/[0.07] text-slate-800 dark:text-white text-xs rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition border border-slate-200 dark:border-white/[0.06]';

function FormatSelect({ job }: { job: QueueJob }): JSX.Element {
  const setOutputFormat = useQueueStore((s) => s.setOutputFormat);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    e.stopPropagation();
    const fmt = e.target.value;
    setOutputFormat(job.id, fmt);
    await invokeSetOutputFormat(job.id, fmt);
  }

  return (
    <select value={job.output_format} onChange={handleChange} onClick={(e) => e.stopPropagation()}
      disabled={job.status !== 'pending'} className={selectCls}>
      {FORMAT_OPTIONS.map((f) => (
        <option key={f} value={f} className="bg-white dark:bg-[#111827]">{f.toUpperCase()}</option>
      ))}
    </select>
  );
}

function BitrateSelect({ job }: { job: QueueJob }): JSX.Element {
  const setBitrate = useQueueStore((s) => s.setBitrate);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    e.stopPropagation();
    const br = e.target.value;
    setBitrate(job.id, br);
    await invokeSetBitrate(job.id, br);
  }

  return (
    <select value={job.bitrate || ''} onChange={handleChange} onClick={(e) => e.stopPropagation()}
      disabled={job.status !== 'pending'} className={selectCls}>
      {BITRATE_OPTIONS.map((b) => (
        <option key={b} value={b} className="bg-white dark:bg-[#111827]">{b || 'Auto'}</option>
      ))}
    </select>
  );
}

function SampleRateSelect({ job }: { job: QueueJob }): JSX.Element {
  const setSampleRate = useQueueStore((s) => s.setSampleRate);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    e.stopPropagation();
    const sr = e.target.value;
    setSampleRate(job.id, sr);
    await invokeSetSampleRate(job.id, sr);
  }

  return (
    <select value={job.sample_rate || ''} onChange={handleChange} onClick={(e) => e.stopPropagation()}
      disabled={job.status !== 'pending'} className={selectCls}>
      {SAMPLE_RATE_OPTIONS.map((r) => (
        <option key={r} value={r} className="bg-white dark:bg-[#111827]">{r ? `${r} Hz` : 'Auto'}</option>
      ))}
    </select>
  );
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableJobRow({ job, index, isSelected, onSelect, isImporting, activeDragId }: {
  job: QueueJob;
  index: number;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  isImporting?: boolean;
  activeDragId: string | null;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const selectedJobIds = useQueueStore((s) => s.selectedJobIds);
  // Only treat as a group drag when the DRAGGED item is itself selected.
  // Without this guard, dragging an unselected row hides all selected rows.
  const isDragOfSelectedItem = !!(activeDragId && selectedJobIds.includes(activeDragId));
  const isDraggingAnySelected = isDragOfSelectedItem && selectedJobIds.includes(job.id);
  const setAbMode = useQueueStore((s) => s.setAbMode);
  const isLocked = useQueueStore((s) => s.lockedJobIds.includes(job.id));
  const unlockJobs = useQueueStore((s) => s.unlockJobs);
  const defaultOutputFolder = useSettingsStore((s) => s.outputFolder);

  const isEnhanced = job.ab_mode === 'enhanced';
  // Primary drag item stays in DOM (opacity 0) so DnD kit can measure it for
  // correct sibling transforms. Only secondary selected items are display:none.
  const isSecondaryDrag = isDraggingAnySelected && !isDragging;

  const rowStyle = {
    transform: isDraggingAnySelected ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isDraggingAnySelected ? 0 : undefined,
    display: isSecondaryDrag ? 'none' : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={rowStyle}
      onClick={isImporting ? undefined : onSelect}
      data-job-id={job.id}
      className={clsx(
        'group border-b border-slate-100 dark:border-white/[0.04] last:border-0 transition-colors duration-100',
        isImporting
          ? 'opacity-40 pointer-events-none cursor-default bg-slate-50 dark:bg-white/[0.02]'
          : clsx(
              'cursor-pointer',
              isSelected
                ? 'bg-violet-50 dark:bg-violet-500/[0.08] border-l-2 border-l-violet-500'
                : isEnhanced
                  ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.05] hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.08]'
                  : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]',
            ),
      )}
    >
      <td className="px-2 py-2 w-8">
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors cursor-grab active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="px-4 py-2 text-slate-400 dark:text-white/25 text-xs w-10 tabular-nums">{index + 1}</td>
      <td className="px-4 py-2 text-sm text-slate-800 dark:text-slate-100 font-medium truncate max-w-[180px]">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              useUIStore.getState().setActivePlayerJobId(job.id);
              useUIStore.getState().setPlayerOpen(true);
            }}
            className="p-1 rounded bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 transition shrink-0"
            title="Open in Waveform Player"
          >
            <Play size={10} fill="currentColor" />
          </button>
          <span className="truncate">{job.filename}</span>
        </div>
      </td>
      <td
        className="px-2 py-2 text-xs text-slate-400 dark:text-white/40 truncate max-w-[130px] group/dest"
        title={job.destination || 'Click to set destination'}
      >
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const sel = await openDialog({ directory: true, multiple: false, title: 'Select Output Folder' });
            if (typeof sel !== 'string' || !sel) return;
            const { selectedJobIds, setDestination, setDestinationBatch } = useQueueStore.getState();
            if (selectedJobIds.includes(job.id)) setDestinationBatch(selectedJobIds, sel);
            else setDestination(job.id, sel);
          }}
          className="flex items-center gap-1 w-full truncate hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
        >
          <FolderOpen size={11} className="shrink-0 opacity-0 group-hover/dest:opacity-100 transition-opacity" />
          <span className="truncate">{job.destination || defaultOutputFolder || '—'}</span>
        </button>
      </td>
      <td className="px-4 py-2 text-xs text-slate-400 dark:text-white/40 w-20 tabular-nums">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-slate-400 dark:text-white/35 w-16">{job.media_type}</td>
      <td className="px-4 py-2 w-24"><FormatSelect job={job} /></td>
      <td className="px-4 py-2 w-24"><BitrateSelect job={job} /></td>
      <td className="px-4 py-2 w-24"><SampleRateSelect job={job} /></td>
      <td className="px-4 py-2 text-xs font-medium w-40">
        {job.status === 'done' && job.output_filepath ? (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setAbMode(job.id, 'enhanced'); }}
              className={clsx(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150',
                isEnhanced
                  ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
                  : 'text-slate-400 dark:text-white/35 hover:bg-slate-100 dark:hover:bg-white/[0.07]',
              )}
            >
              Enhanced
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAbMode(job.id, 'original'); }}
              className={clsx(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150',
                !isEnhanced
                  ? 'bg-slate-200 dark:bg-white/[0.12] text-slate-700 dark:text-white/80'
                  : 'text-slate-400 dark:text-white/35 hover:bg-slate-100 dark:hover:bg-white/[0.07]',
              )}
            >
              Original
            </button>
          </div>
        ) : (
          <StatusBadge status={job.status} progress={job.progress} errorMessage={job.error_message} />
        )}
      </td>
      <td className="px-2 py-2 w-8 group/lock">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isLocked) unlockJobs([job.id]);
            else useQueueStore.getState().lockJobs([job.id]);
          }}
          title={isLocked ? 'Locked — click to unlock' : 'Click to lock'}
          className={clsx(
            'block mx-auto transition-all duration-150',
            isLocked
              ? 'text-slate-500 dark:text-white/70 opacity-100'
              : 'text-slate-300 dark:text-white/25 opacity-0 group-hover/lock:opacity-100',
          )}
        >
          <Lock size={12} />
        </button>
      </td>
      <td className="px-2 py-2 w-8 group/trash">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isLocked) return;
            const { deleteJobs } = useQueueStore.getState();
            const activePlayerJobId = useUIStore.getState().activePlayerJobId;
            if (activePlayerJobId === job.id) {
              useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
            }
            deleteJobs([job.id]);
            void invokeArchiveJobs([job.id]);
          }}
          disabled={isLocked}
          title={isLocked ? "Cannot delete locked item" : "Delete item"}
          className={clsx(
            "block mx-auto transition-all duration-150",
            isLocked
              ? "text-slate-300 dark:text-white/10 cursor-not-allowed opacity-20"
              : "text-slate-300 dark:text-white/25 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover/trash:opacity-100"
          )}
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ─── Sortable card (grid view) ────────────────────────────────────────────────

function SortableJobCard({ job, isSelected, onSelect, isImporting, activeDragId }: {
  job: QueueJob;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  isImporting?: boolean;
  activeDragId: string | null;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const selectedJobIds = useQueueStore((s) => s.selectedJobIds);
  const isDragOfSelectedItem = !!(activeDragId && selectedJobIds.includes(activeDragId));
  const isDraggingAnySelected = isDragOfSelectedItem && selectedJobIds.includes(job.id);
  const { playingJobId, isPlaying, toggle } = useAudioPlayer();
  const setAbMode = useQueueStore((s) => s.setAbMode);
  const isLocked = useQueueStore((s) => s.lockedJobIds.includes(job.id));
  const unlockJobs = useQueueStore((s) => s.unlockJobs);

  const isThisPlaying = playingJobId === job.id && isPlaying;
  const isEnhanced = job.ab_mode === 'enhanced';

  function handlePlay(e: React.MouseEvent): void {
    e.stopPropagation();
    const src = isEnhanced && job.output_filepath ? job.output_filepath : job.filepath;
    toggle(job.id, src);
  }

  const isSecondaryDrag = isDraggingAnySelected && !isDragging;

  const cardStyle = {
    transform: isDraggingAnySelected ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isDraggingAnySelected ? 0 : undefined,
    display: isSecondaryDrag ? 'none' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      onClick={isImporting ? undefined : onSelect}
      data-job-id={job.id}
      className={clsx(
        'rounded-xl p-3 border transition-all duration-150 select-none',
        isImporting
          ? 'opacity-40 pointer-events-none cursor-default bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.04]'
          : clsx(
              'cursor-pointer',
              isDragging ? 'scale-[0.98]' : '',
              isSelected
                ? 'bg-violet-50 dark:bg-violet-500/[0.08] border-violet-300 dark:border-violet-500/40'
                : isEnhanced
                  ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.05] border-emerald-200 dark:border-emerald-500/15 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.08]'
                  : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.10]',
            ),
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0 flex-grow">
          <button
            onClick={(e) => {
              e.stopPropagation();
              useUIStore.getState().setActivePlayerJobId(job.id);
              useUIStore.getState().setPlayerOpen(true);
            }}
            className="p-1 rounded bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 transition shrink-0"
            title="Open in Waveform Player"
          >
            <Play size={10} fill="currentColor" />
          </button>
          <span className="text-sm text-slate-800 dark:text-slate-100 font-medium truncate flex-1">{job.filename}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="group/lock">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isLocked) unlockJobs([job.id]);
                else useQueueStore.getState().lockJobs([job.id]);
              }}
              title={isLocked ? 'Locked — click to unlock' : 'Click to lock'}
              className={clsx(
                'transition-all duration-150',
                isLocked ? 'text-slate-400 dark:text-white/60 opacity-100' : 'text-slate-300 dark:text-white/20 opacity-0 group-hover/lock:opacity-100',
              )}
            >
              <Lock size={12} />
            </button>
          </div>
          <button
            onClick={handlePlay}
            className={clsx(
              'flex items-center justify-center w-5 h-5 rounded-full transition-all duration-150',
              isThisPlaying
                ? 'text-violet-500 bg-violet-100 dark:bg-violet-500/20'
                : 'text-slate-300 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
            )}
            aria-label={isThisPlaying ? 'Pause' : 'Play'}
          >
            {isThisPlaying ? <Pause size={10} /> : <Play size={10} />}
          </button>
          {job.status === 'done' && job.output_filepath ? (
            <div className="flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setAbMode(job.id, 'enhanced'); toggle(job.id, job.output_filepath!); }}
                className={clsx('px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150', isEnhanced ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-white/35 hover:bg-slate-100 dark:hover:bg-white/[0.07]')}
              >Enh</button>
              <button
                onClick={(e) => { e.stopPropagation(); setAbMode(job.id, 'original'); toggle(job.id, job.filepath); }}
                className={clsx('px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150', !isEnhanced ? 'bg-slate-200 dark:bg-white/[0.12] text-slate-700 dark:text-white/80' : 'text-slate-400 dark:text-white/35 hover:bg-slate-100 dark:hover:bg-white/[0.07]')}
              >Orig</button>
            </div>
          ) : (
            <span className={clsx(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize',
              STATUS_BADGE_CLS[job.status],
            )}>
              {job.status === 'processing' && <span className="w-1 h-1 rounded-full bg-amber-400 status-processing-dot" />}
              {job.status}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-white/35 flex-wrap">
        <span className="tabular-nums">{formatBytes(job.size_bytes)}</span>
        <span className="uppercase">{job.media_type}</span>
        <span className="uppercase font-medium text-slate-500 dark:text-white/50">{job.output_format}</span>
        {job.bitrate && <span>{job.bitrate}</span>}
      </div>
      {job.status === 'processing' && (
        <div className="mt-2 h-[3px] w-full rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${job.progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main QueueGrid ───────────────────────────────────────────────────────────

export default function QueueGrid(): JSX.Element {
  const activeTab = useUIStore((s) => s.activeTab);
  const jobs = useQueueStore((s) => s.filteredJobs(activeTab));
  const groups = useQueueStore((s) => s.groupedFilteredJobs(activeTab));
  const setProgress = useQueueStore((s) => s.setProgress);
  const setStatus = useQueueStore((s) => s.setStatus);
  const setOutputFilepath = useQueueStore((s) => s.setOutputFilepath);
  const setAbMode = useQueueStore((s) => s.setAbMode);
  const reorderJobs = useQueueStore((s) => s.reorderJobs);
  const selectedJobIds = useQueueStore((s) => s.selectedJobIds);
  const { setSelectedJob, toggleSelectJob, rangeSelectJobs } = useQueueStore();
  const viewMode = useQueueStore((s) => s.viewMode);
  const groupByFormat = useQueueStore((s) => s.groupByFormat);
  const clearSelection = useQueueStore((s) => s.clearSelection);
  const { t } = useTranslation();
  const [colWidths, setColWidths] = useState({ filename: 180, destination: 140 });

  const importingJobIds = useQueueStore((s) => s.importingJobIds);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const dragSelectedIds = useMemo((): string[] => {
    if (!activeDragId) return [];
    return selectedJobIds.includes(activeDragId) ? selectedJobIds : [];
  }, [activeDragId, selectedJobIds]);

  const visibleJobs = useMemo((): QueueJob[] => {
    if (!activeDragId || dragSelectedIds.length <= 1) return jobs;
    return jobs.filter((j) => j.id === activeDragId || !dragSelectedIds.includes(j.id));
  }, [jobs, activeDragId, dragSelectedIds]);

  const visibleGroups = useMemo(() => {
    if (!activeDragId || dragSelectedIds.length <= 1) return groups;
    return groups.map((g) => ({
      ...g,
      jobs: g.jobs.filter((j) => j.id === activeDragId || !dragSelectedIds.includes(j.id)),
    })).filter((g) => g.jobs.length > 0);
  }, [groups, activeDragId, dragSelectedIds]);

  const draggingJobs = useMemo((): QueueJob[] => {
    if (!activeDragId) return [];
    const ids = selectedJobIds.includes(activeDragId) ? selectedJobIds : [activeDragId];
    return ids.map((id) => jobs.find((j) => j.id === id)).filter((j): j is QueueJob => j !== undefined);
  }, [activeDragId, selectedJobIds, jobs]);

  async function handleClearQueue(): Promise<void> {
    const { jobs, lockedJobIds, clearQueue } = useQueueStore.getState();
    const idsToArchive = jobs.filter((j) => !lockedJobIds.includes(j.id)).map((j) => j.id);
    const activePlayerJobId = useUIStore.getState().activePlayerJobId;
    if (activePlayerJobId && idsToArchive.includes(activePlayerJobId)) {
      useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
    }
    clearQueue();
    if (idsToArchive.length > 0) {
      void invokeArchiveJobs(idsToArchive);
    }
  }

  function handleContainerMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Only block interactive elements — allow starting drag on rows
    if (
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input')
    ) {
      return;
    }

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    // Capture container bounds so visual marquee stays within the queue area
    const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dragStarted = false;

    const onMouseMove = (ev: MouseEvent) => {
      // Clamp cursor to container bounds for the visual selection box
      const clampedX = Math.max(containerRect.left, Math.min(containerRect.right, ev.clientX));
      const clampedY = Math.max(containerRect.top, Math.min(containerRect.bottom, ev.clientY));

      const left = Math.min(startX, clampedX);
      const top = Math.min(startY, clampedY);
      const width = Math.abs(startX - clampedX);
      const height = Math.abs(startY - clampedY);

      if (!dragStarted && (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3)) {
        dragStarted = true;
      }

      if (dragStarted) {
        setSelectionBox({ left, top, width, height });

        const elements = document.querySelectorAll('[data-job-id]');
        const intersectedIds: string[] = [];
        elements.forEach((el) => {
          const jobId = el.getAttribute('data-job-id');
          if (!jobId) return;
          const box = el.getBoundingClientRect();
          const intersects = (
            left < box.right &&
            left + width > box.left &&
            top < box.bottom &&
            top + height > box.top
          );
          if (intersects) intersectedIds.push(jobId);
        });

        const { selectedJobIds } = useQueueStore.getState();
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
          const merged = [...new Set([...selectedJobIds, ...intersectedIds])];
          useQueueStore.setState({ selectedJobIds: merged });
        } else {
          useQueueStore.setState({ selectedJobIds: intersectedIds });
        }
      }
    };

    const onMouseUp = () => {
      setSelectionBox(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      // If a drag occurred, cancel the next click so the row's onClick doesn't fire
      if (dragStarted) {
        const cancelClick = (ev: Event): void => {
          ev.stopPropagation();
          window.removeEventListener('click', cancelClick, true);
        };
        window.addEventListener('click', cancelClick, true);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  const adjustWidth = (col: keyof typeof colWidths, delta: number): void =>
    setColWidths((p) => ({ ...p, [col]: Math.max(80, p[col] + delta) }));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (label: string): void =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const unlistenProgress = listen<{ jobId: string; percent: number }>(
      'queue://progress',
      (e) => setProgress(e.payload.jobId, e.payload.percent)
    );
    const unlistenStatus = listen<{ jobId: string; status: string; error_message?: string; outputFilepath?: string }>(
      'queue://status-change',
      (e) => {
        const { jobId, status, error_message, outputFilepath } = e.payload;
        setStatus(jobId, status as JobStatus, error_message);
        if (outputFilepath) {
          setOutputFilepath(jobId, outputFilepath);
          if (status === 'done') setAbMode(jobId, 'enhanced');
        }
      }
    );
    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [setProgress, setStatus, setOutputFilepath, setAbMode]);

  function handleRowClick(e: React.MouseEvent, jobId: string): void {
    if (e.shiftKey) {
      rangeSelectJobs(jobId);
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelectJob(jobId);
    } else {
      setSelectedJob(selectedJobIds.length === 1 && selectedJobIds[0] === jobId ? null : jobId);
    }
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderJobs(String(active.id), String(over.id));
    }
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <p className="text-slate-400 dark:text-white/25 text-sm">{t('queue.empty')}</p>
    </div>
  );

  if (viewMode === 'grid') {
    return (
      <>
        <div
          className="flex-1 overflow-auto scrollbar-thin"
          onMouseDown={handleContainerMouseDown}
          onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
        >
          {jobs.length === 0 ? emptyState : groupByFormat ? (
            <div className="flex flex-col gap-4 p-1">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/35 px-1 pb-2 border-b border-slate-200 dark:border-white/[0.07] mb-2 w-full hover:text-slate-700 dark:hover:text-white/60 transition-colors"
                  >
                    <ChevronRight size={11} className={`transition-transform shrink-0 ${collapsedGroups.has(group.label) ? '' : 'rotate-90'}`} />
                    {group.label}
                    <span className="text-slate-300 dark:text-white/20 font-normal ml-0.5">({group.jobs.length})</span>
                  </button>
                  {!collapsedGroups.has(group.label) && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                      <SortableContext items={group.jobs.map((j) => j.id)} strategy={rectSortingStrategy}>
                        <div
                          className="grid grid-cols-3 gap-2"
                          onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
                        >
                          {group.jobs.map((job) => (
                            <SortableJobCard
                              key={job.id}
                              job={job}
                              isSelected={selectedJobIds.includes(job.id)}
                              onSelect={(e) => handleRowClick(e, job.id)}
                              isImporting={importingJobIds.includes(job.id)}
                              activeDragId={activeDragId}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <DragOverlay dropAnimation={null}>
                        {activeDragId && draggingJobs.length > 0 && (
                          <div className="relative select-none w-[220px]">
                            {draggingJobs.length > 1 && (
                              <div className="absolute left-2 top-2 w-full h-full rounded-xl bg-violet-400/15 border border-violet-300/25" />
                            )}
                            <div className="relative rounded-xl p-3 bg-white dark:bg-[#0D1525] border border-violet-400/50 shadow-xl shadow-violet-500/15">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{draggingJobs[0].filename}</span>
                              <span className="text-[10px] text-slate-400 dark:text-white/35 mt-1 block">{formatBytes(draggingJobs[0].size_bytes)}</span>
                              {draggingJobs.length > 1 && (
                                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                                  {draggingJobs.length}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </DragOverlay>
                    </DndContext>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleJobs.map((j) => j.id)} strategy={rectSortingStrategy}>
                <div
                  className="grid grid-cols-3 gap-2 p-1"
                  onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
                >
                  {visibleJobs.map((job) => (
                    <SortableJobCard
                      key={job.id}
                      job={job}
                      isSelected={selectedJobIds.includes(job.id)}
                      onSelect={(e) => handleRowClick(e, job.id)}
                      isImporting={importingJobIds.includes(job.id)}
                      activeDragId={activeDragId}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeDragId && draggingJobs.length > 0 && (
                  <div className="relative select-none w-[220px]">
                    {draggingJobs.length > 1 && (
                      <div className="absolute left-2 top-2 w-full h-full rounded-xl bg-violet-400/15 border border-violet-300/25" />
                    )}
                    <div className="relative rounded-xl p-3 bg-white dark:bg-[#0D1525] border border-violet-400/50 shadow-xl shadow-violet-500/15">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{draggingJobs[0].filename}</span>
                      <span className="text-[10px] text-slate-400 dark:text-white/35 mt-1 block">{formatBytes(draggingJobs[0].size_bytes)}</span>
                      {draggingJobs.length > 1 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                          {draggingJobs.length}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {selectionBox && (
          <div
            className="fixed z-50 pointer-events-none border border-violet-500 bg-violet-500/10 rounded"
            style={{
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}
      </>
    );
  }

  const tableHeader = (
    <thead>
      <tr className="text-slate-500 dark:text-white/35 font-semibold text-[10px] uppercase tracking-wider sticky top-0 bg-slate-50 dark:bg-[#090E1B] border-b-2 border-slate-200 dark:border-white/[0.08]">
        <th className="px-2 py-2.5 w-8" />
        <th className="px-4 py-2.5 w-10">#</th>
        <th className="resizable-th px-2 py-2.5 text-left" style={{ width: colWidths.filename, minWidth: 80 }}>
          <span className="px-2">{t('queue.col.filename')}</span>
          <ResizeHandle onDelta={(d) => adjustWidth('filename', d)} />
        </th>
        <th className="resizable-th px-2 py-2.5 text-left" style={{ width: colWidths.destination, minWidth: 80 }}>
          <span className="px-2">{t('queue.col.destination')}</span>
          <ResizeHandle onDelta={(d) => adjustWidth('destination', d)} />
        </th>
        <th className="px-4 py-2.5 w-20">{t('queue.col.size')}</th>
        <th className="px-4 py-2.5 w-16">{t('queue.col.type')}</th>
        <th className="px-4 py-2.5 w-24">{t('queue.col.output')}</th>
        <th className="px-4 py-2.5 w-24">{t('queue.col.bitrate')}</th>
        <th className="px-4 py-2.5 w-28 whitespace-nowrap">{t('queue.col.sampleHz')}</th>
        <th className="px-4 py-2.5 w-40">{t('queue.col.status')}</th>
        <th className="px-2 py-2.5 w-8 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const { jobs, lockedJobIds, lockAllJobs, unlockAllJobs } = useQueueStore.getState();
              if (lockedJobIds.length === jobs.length) {
                unlockAllJobs();
              } else {
                lockAllJobs();
              }
            }}
            title="Lock / Unlock all items"
            className="text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
          >
            <Lock size={11} className="mx-auto" />
          </button>
        </th>
        <th className="px-2 py-2.5 w-8 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowClearConfirm(true);
            }}
            className="text-red-500 hover:text-red-400 font-semibold text-[10px] uppercase tracking-wider transition-colors"
            title="Clear all non-locked items"
          >
            Clear
          </button>
        </th>
      </tr>
    </thead>
  );

  return (
    <>
      <div
        className="flex-1 overflow-auto rounded-xl bg-white dark:bg-[#0C1120] shadow-sm border border-slate-200 dark:border-white/[0.06] scrollbar-thin"
        onMouseDown={handleContainerMouseDown}
        onClick={(e) => { if ((e.target as HTMLElement).closest('tr') === null) clearSelection(); }}
      >
        <table className="w-full text-left queue-table">
          {tableHeader}
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-16 text-center text-slate-400 dark:text-white/25 text-sm">
                  {t('queue.empty')}
                </td>
              </tr>
            ) : groupByFormat ? (
              <>
                {visibleGroups.map((group, gi) => (
                  <React.Fragment key={`group-${gi}`}>
                    <tr>
                      <td colSpan={12} className="px-4 pt-3 pb-1">
                        <button
                          onClick={() => toggleGroup(group.label)}
                          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400/80 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                        >
                          <ChevronRight size={11} className={`transition-transform shrink-0 ${collapsedGroups.has(group.label) ? '' : 'rotate-90'}`} />
                          {group.label}
                          <span className="text-slate-300 dark:text-white/20 font-normal ml-0.5">({group.jobs.length})</span>
                        </button>
                      </td>
                    </tr>
                    {!collapsedGroups.has(group.label) && (
                      <DndContext key={`dnd-${gi}`} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}>
                        <SortableContext items={group.jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                          <AnimatePresence>
                            {group.jobs.map((job, i) => (
                              <SortableJobRow
                                key={job.id}
                                job={job}
                                index={groups.find((g) => g.label === group.label)?.jobs.findIndex((j) => j.id === job.id) ?? i}
                                isSelected={selectedJobIds.includes(job.id)}
                                onSelect={(e) => handleRowClick(e, job.id)}
                                isImporting={importingJobIds.includes(job.id)}
                                activeDragId={activeDragId}
                              />
                            ))}
                          </AnimatePresence>
                        </SortableContext>
                        <DragOverlay dropAnimation={null}>
                          {activeDragId && draggingJobs.length > 0 && (
                            <div className="relative select-none" style={{ width: 340 }}>
                              {draggingJobs.length > 1 && (
                                <div className="absolute left-1.5 top-1.5 right-0 h-10 rounded-lg bg-violet-400/10 border border-violet-300/20" />
                              )}
                              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white dark:bg-[#0D1525] border border-violet-400/50 shadow-xl shadow-violet-500/15">
                                <GripVertical size={13} className="text-violet-400/50 shrink-0" />
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex-1">{draggingJobs[0].filename}</span>
                                {draggingJobs.length > 1 && (
                                  <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold shrink-0">+{draggingJobs.length - 1}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}>
                <SortableContext items={visibleJobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                  <AnimatePresence>
                    {visibleJobs.map((job) => (
                      <SortableJobRow
                        key={job.id}
                        job={job}
                        index={jobs.findIndex((j) => j.id === job.id)}
                        isSelected={selectedJobIds.includes(job.id)}
                        onSelect={(e) => handleRowClick(e, job.id)}
                        isImporting={importingJobIds.includes(job.id)}
                        activeDragId={activeDragId}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragId && draggingJobs.length > 0 && (
                    <div className="relative select-none" style={{ width: 340 }}>
                      {draggingJobs.length > 1 && (
                        <div className="absolute left-1.5 top-1.5 right-0 h-10 rounded-lg bg-violet-400/10 border border-violet-300/20" />
                      )}
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white dark:bg-[#0D1525] border border-violet-400/50 shadow-xl shadow-violet-500/15">
                        <GripVertical size={13} className="text-violet-400/50 shrink-0" />
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex-1">{draggingJobs[0].filename}</span>
                        {draggingJobs.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold shrink-0">+{draggingJobs.length - 1}</span>
                        )}
                      </div>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </tbody>
        </table>
      </div>

      {selectionBox && (
        <div
          className="fixed z-50 pointer-events-none border border-violet-500 bg-violet-500/10 rounded"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
          }}
        />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Confirm Clear Queue</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Are you sure you want to clear the entire queue? Locked files will not be deleted. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowClearConfirm(false);
                  await handleClearQueue();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
