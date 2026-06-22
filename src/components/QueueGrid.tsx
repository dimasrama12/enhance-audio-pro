import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { GripVertical, Play, Lock, ChevronRight, Trash2, Wand2, Download, RefreshCw, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import ProcessingTimer from '@/components/ProcessingTimer';
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
import { invokeSetOutputFormat, invokeSetBitrate, invokeSetSampleRate, invokeArchiveJobs, invokeProcessQueue, invokeCancelJobs, invokeSetJobStatus, invokeCopyEnhancedFile, invokeConvertFiles, invokeDeleteFile } from '@/lib/ipc';
import { useToastStore } from '@/stores/useToastStore';
import { logError } from '@/lib/errorLogger';
import type { QueueJob, JobStatus } from '@/types/queue';

// ─── Column widths ────────────────────────────────────────────────────────────

type ColKey = 'grip' | 'index' | 'filename' | 'destination' | 'size' | 'format' | 'bitrate' | 'sampleRate' | 'status' | 'tools' | 'lock' | 'clear';

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  grip: 28,
  index: 34,
  filename: 208,
  destination: 124,
  size: 65,
  format: 75,
  bitrate: 72,
  sampleRate: 80,
  status: 70,
  tools: 112,
  lock: 41,
  clear: 46,
};

const ENHANCE_COL_WIDTHS: Record<ColKey, number> = {
  grip: 28,
  index: 34,
  filename: 400,
  destination: 183,
  size: 76,
  format: 75,
  bitrate: 72,
  sampleRate: 80,
  status: 76,
  tools: 73,
  lock: 34,
  clear: 46,
};

const CONVERT_COL_WIDTHS: Record<ColKey, number> = {
  grip: 28,
  index: 34,
  filename: 500,
  destination: 183,
  size: 76,
  format: 87,
  bitrate: 72,
  sampleRate: 80,
  status: 76,
  tools: 73,
  lock: 34,
  clear: 46,
};



// ─── Resize handle ────────────────────────────────────────────────────────────

function ResizeHandle({
  colKey: _colKey,
  onResize: _onResize,
  disabled: _disabled
}: {
  colKey: ColKey;
  onResize: (key: ColKey, delta: number) => void;
  disabled?: boolean;
}): JSX.Element | null {
  // Column resizing is locked by request
  return null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE_CLS: Record<JobStatus, string> = {
  pending: 'bg-slate-400/10 text-slate-500 dark:text-slate-400',
  queued: 'bg-blue-400/10 text-blue-500 dark:text-blue-400',
  processing: 'bg-amber-400/10 text-amber-600 dark:text-amber-400',
  done: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'bg-red-500/10 text-red-500 dark:text-red-400',
};

function StatusBadge({ status, progress, errorMessage, onErrorClick }: {
  status: JobStatus;
  progress: number;
  errorMessage?: string | null;
  onErrorClick?: (e: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <span
        onClick={status === 'error' ? (e) => { e.stopPropagation(); onErrorClick?.(e); } : undefined}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize mx-auto',
          STATUS_BADGE_CLS[status],
          status === 'error' && 'cursor-pointer hover:bg-red-500/20 active:scale-95 transition-all',
        )}
        title={status === 'error' ? (errorMessage ?? undefined) : undefined}
      >
        {status === 'processing' && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 status-processing-dot shrink-0" />
        )}
        {status}
      </span>
      {status === 'processing' && (
        <div className="mt-1.5 h-[3px] w-full max-w-[100px] mx-auto rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
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

const selectCls =
  'bg-slate-100 dark:bg-white/[0.07] text-slate-800 dark:text-white text-[10px] rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition border border-slate-200 dark:border-white/[0.06] w-full text-center';

function FormatSelect({ job }: { job: QueueJob }): JSX.Element {
  const setOutputFormat = useQueueStore((s) => s.setOutputFormat);
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    e.stopPropagation();
    const fmt = e.target.value;
    setOutputFormat(job.id, fmt);
    await invokeSetOutputFormat(job.id, fmt);
  }

  const inputExt = job.filename.split('.').pop()?.toLowerCase() ?? '';
  let options = FORMAT_OPTIONS;
  let isDisabled = job.status !== 'pending';

  if (audioSubTab === 'convert') {
    if (inputExt === 'mp3') {
      options = ['wav'];
      isDisabled = true;
    } else if (inputExt === 'wav') {
      options = ['mp3'];
      isDisabled = true;
    } else {
      options = ['wav', 'mp3'];
    }
  }

  return (
    <select value={job.output_format} onChange={handleChange} onClick={(e) => e.stopPropagation()}
      disabled={isDisabled} className={selectCls}>
      {options.map((f) => (
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

function getSourceDir(filepath: string): string {
  if (!filepath) return '';
  const lastSep = Math.max(filepath.lastIndexOf('\\'), filepath.lastIndexOf('/'));
  return lastSep > 0 ? filepath.substring(0, lastSep) : filepath;
}

// ─── Per-row tool mode selector ───────────────────────────────────────────────

function ToolModeSelect({ jobId, audioSubTab }: { jobId: string; audioSubTab: string }): JSX.Element {
  const mode = useQueueStore((s) => s.tabJobOpTypes[audioSubTab as 'enhance'|'convert'|'separate'][jobId] ?? 'enhance');
  const setJobOperationMode = useQueueStore((s) => s.setJobOperationMode);
  return (
    <select
      value={mode}
      onChange={(e) => { e.stopPropagation(); setJobOperationMode(jobId, e.target.value as 'enhance' | 'convert'); }}
      onClick={(e) => e.stopPropagation()}
      className="bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-white text-[10px] rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 border border-slate-200 dark:border-white/[0.06] cursor-pointer"
    >
      <option value="enhance" className="bg-white dark:bg-[#111827]">Enh</option>
      <option value="convert" className="bg-white dark:bg-[#111827]">Conv</option>
    </select>
  );
}

// ─── Per-row enhance button ────────────────────────────────────────────────────

function EnhanceRowButton({ job }: { job: QueueJob }): JSX.Element | null {
  const enhancementStrength = useSettingsStore((s) => s.enhancementStrength);
  const { addToast } = useToastStore();
  const isProcessing = job.status === 'processing';
  const isQueued = job.status === 'queued';
  const canCancel = isProcessing || isQueued;

  if (job.status === 'done') return null;

  async function handleEnhance(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (canCancel) {
      try { await invokeCancelJobs([job.id]); addToast(`Cancelled "${job.filename}"`, 'info'); }
      catch (err) { console.error('Failed to cancel', err); }
      return;
    }
    const tab = useUIStore.getState().audioSubTab;
    const tabJobs = useQueueStore.getState().tabQueues[tab];
    const hasActive = tabJobs.some((j) => j.status === 'processing');
    const { aiModel } = useSettingsStore.getState();
    if (hasActive) {
      try {
        useQueueStore.getState().setStatus(job.id, 'queued');
        await invokeSetJobStatus(job.id, 'queued');
        addToast(`Queued "${job.filename}"`, 'info');
      } catch (err) { console.error('Failed to queue job', err); }
    } else {
      await invokeProcessQueue([job.id], enhancementStrength, aiModel);
    }
  }

  return (
    <button onClick={handleEnhance}
      title={canCancel ? 'Cancel processing' : job.status === 'error' ? 'Retry enhancement' : 'Enhance this file'}
      className={clsx(
        'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150',
        canCancel ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
          : job.status === 'error' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
          : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20',
      )}>
      {canCancel ? <Trash2 size={10} /> : <Wand2 size={10} />}
      {canCancel ? 'Cancel' : job.status === 'error' ? 'Retry' : 'Enhance'}
    </button>
  );
}

// ─── Per-row convert button ────────────────────────────────────────────────────

function ConvertRowButton({ job }: { job: QueueJob }): JSX.Element | null {
  const filenameTemplate = useSettingsStore((s) => s.filenameTemplate);
  const { addToast } = useToastStore();
  const canCancel = job.status === 'processing' || job.status === 'queued';

  if (job.status === 'done') return null;

  async function handleClick(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (canCancel) {
      try { await invokeCancelJobs([job.id]); addToast(`Cancelled "${job.filename}"`, 'info'); }
      catch (err) { console.error('Failed to cancel', err); }
      return;
    }
    const tab = useUIStore.getState().audioSubTab;
    const tabJobs = useQueueStore.getState().tabQueues[tab];
    const hasActive = tabJobs.some((j) => j.status === 'processing');
    if (hasActive) {
      const { setStatus, setJobOperationMode } = useQueueStore.getState();
      setJobOperationMode(job.id, 'convert', tab);
      setStatus(job.id, 'queued');
      await invokeSetJobStatus(job.id, 'queued');
      addToast(`Queued "${job.filename}" for conversion`, 'info');
    } else {
      useQueueStore.getState().setJobOperationMode(job.id, 'convert', tab);
      await invokeConvertFiles([job.id], filenameTemplate);
    }
  }

  return (
    <button onClick={handleClick}
      title={canCancel ? 'Cancel' : job.status === 'error' ? 'Retry conversion' : 'Convert this file'}
      className={clsx(
        'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150',
        canCancel ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
          : job.status === 'error' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
      )}>
      {canCancel ? <Trash2 size={10} /> : <RefreshCw size={10} />}
      {canCancel ? 'Cancel' : job.status === 'error' ? 'Retry' : 'Convert'}
    </button>
  );
}

// ─── Per-row download button ───────────────────────────────────────────────────

function DownloadJobButton({ job }: { job: QueueJob }): JSX.Element | null {
  const { addToast } = useToastStore();
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  if (job.status !== 'done') return null;
  const canDownload = !!job.output_filepath;

  async function handleDownload(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!canDownload || !job.output_filepath) return;
    const srcPath = job.output_filepath;
    const filename = srcPath.replace(/\\/g, '/').split('/').pop() ?? job.filename;
    const dialogTitle = audioSubTab === 'convert' ? 'Save Converted File As' : 'Save Enhanced File As';
    const destPath = await saveDialog({ defaultPath: filename, title: dialogTitle });
    if (!destPath) return;
    const res = await invokeCopyEnhancedFile(job.id, srcPath, destPath);
    if (res.success) {
      useQueueStore.getState().setDownloadPath(job.id, destPath);
      if (audioSubTab === 'convert') {
        useQueueStore.getState().setOutputFilepath(job.id, destPath);
      }
      addToast(`Saved "${filename}"`, 'success');
      
      // Delete temporary/original copy from source folder if a different path was chosen
      if (audioSubTab === 'convert' && srcPath !== destPath) {
        try {
          await invokeDeleteFile(srcPath);
        } catch (err) {
          console.error('Failed to clean up source convert file:', err);
        }
      }
    } else {
      addToast(`Save failed: ${res.error ?? 'Unknown error'}`, 'error');
    }
  }

  const titleText = audioSubTab === 'convert'
    ? (canDownload ? 'Download converted file' : 'File not converted yet')
    : (canDownload ? 'Download enhanced file' : 'File not enhanced yet');

  return (
    <button onClick={handleDownload} disabled={!canDownload}
      title={titleText}
      className={clsx(
        'transition-all duration-150',
        canDownload
          ? 'text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 active:scale-95'
          : 'text-slate-300 dark:text-white/15 cursor-not-allowed',
      )}>
      <Download size={12} />
    </button>
  );
}

// ─── Bottom action bar ────────────────────────────────────────────────────────

function QueueActionBar(): JSX.Element {
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  const jobs = useQueueStore((s) => s.tabQueues[audioSubTab]);
  const jobOpTypes = useQueueStore((s) => s.tabJobOpTypes[audioSubTab]);
  const isSeparating = useUIStore((s) => s.isSeparating);

  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'queued');
  const isAnyActive = activeJobs.length > 0;
  const isAnyConverting = activeJobs.some((j) => jobOpTypes[j.id] === 'convert');
  const isAnyEnhancing = activeJobs.some((j) => jobOpTypes[j.id] !== 'convert');

  const canEnhance =
    jobs.filter((j) => j.status === 'pending' || j.status === 'error').length > 0 && !isAnyActive;
  const canConvert =
    jobs.filter((j) => j.status === 'pending').length > 0 && !isAnyActive;
  const canSeparate =
    jobs.filter((j) => j.status === 'pending').length > 0 && !isSeparating && !isAnyActive;

  const ghostBtn =
    'flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-slate-200 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/[0.10] disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex justify-end items-center px-4 py-2 border-t border-slate-200 dark:border-white/[0.06] bg-white/90 dark:bg-[#0C1120]/90 backdrop-blur-sm shrink-0">
      {audioSubTab === 'enhance' && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('action:enhance'))}
          disabled={!canEnhance}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 bg-violet-600 hover:bg-violet-500 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAnyEnhancing ? 'Enhancing…' : 'Enhance All'}
        </button>
      )}
      {audioSubTab === 'convert' && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('action:convert'))}
          disabled={!canConvert}
          className={ghostBtn}
        >
          {isAnyConverting ? 'Converting…' : 'Convert All'}
        </button>
      )}
      {audioSubTab === 'separate' && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('action:separate'))}
          disabled={!canSeparate}
          className={ghostBtn}
        >
          {isSeparating ? 'Separating…' : 'Separate All'}
        </button>
      )}
    </div>
  );
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableJobRow({
  job, index, isSelected, onSelect, isImporting, activeDragId, onErrorClick, colWidths, onResize, audioSubTab,
}: {
  job: QueueJob;
  index: number;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  isImporting?: boolean;
  activeDragId: string | null;
  onErrorClick?: (filename: string, errorMessage: string) => void;
  colWidths: Record<ColKey, number>;
  onResize: (key: ColKey, delta: number) => void;
  audioSubTab: string;
}): JSX.Element {
  const [filenameExpanded, setFilenameExpanded] = useState(false);
  const [destExpanded, setDestExpanded] = useState(false);
  const rowToolMode = useQueueStore((s) => s.tabJobOpTypes[audioSubTab as 'enhance'|'convert'|'separate'][job.id] ?? 'enhance');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const selectedJobIds = useQueueStore((s) => s.tabSelectedIds[audioSubTab as 'enhance'|'convert'|'separate']);
  const isDragOfSelectedItem = !!(activeDragId && selectedJobIds.includes(activeDragId));
  const isDraggingAnySelected = isDragOfSelectedItem && selectedJobIds.includes(job.id);
  const isLocked = useQueueStore((s) => s.tabLockedIds[audioSubTab as 'enhance'|'convert'|'separate'].includes(job.id));
  const unlockJobs = useQueueStore((s) => s.unlockJobs);

  const isEnhanced = job.ab_mode === 'enhanced';
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
      <td className="px-1 py-2 text-center relative" style={{ width: colWidths.grip }}>
        <button {...listeners} {...attributes} onClick={(e) => e.stopPropagation()}
          className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors cursor-grab active:cursor-grabbing mx-auto block"
          tabIndex={-1} aria-label="Drag to reorder">
          <GripVertical size={14} />
        </button>
        <ResizeHandle colKey="grip" onResize={onResize} disabled={false} />
      </td>
      <td className="px-1 py-2 text-slate-400 dark:text-zinc-100 text-xs text-center tabular-nums relative" style={{ width: colWidths.index }}>
        {index + 1}
        <ResizeHandle colKey="index" onResize={onResize} disabled={false} />
      </td>
      <td className={clsx('px-4 py-2 text-sm text-slate-800 dark:text-zinc-100 font-medium relative', !filenameExpanded && 'overflow-hidden')}
        style={{ width: colWidths.filename }}>
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={(e) => { e.stopPropagation(); useUIStore.getState().setActivePlayerJobId(job.id); useUIStore.getState().setPlayerOpen(true); }}
            className="p-1 rounded bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 transition shrink-0"
            title="Open in Waveform Player">
            <Play size={10} fill="currentColor" />
          </button>
          <span onClick={(e) => { e.stopPropagation(); setFilenameExpanded((v) => !v); }}
            className={clsx('flex-1 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors',
              filenameExpanded ? 'break-all whitespace-normal' : 'truncate')}
            title={filenameExpanded ? undefined : job.filename}>
            {job.filename}
          </span>
          {job.status === 'processing' && <span className="ml-auto shrink-0"><ProcessingTimer startedAt={job.startedAt} /></span>}
          {job.status === 'done' && job.completed_duration !== undefined && (
            <span className="text-xs text-yellow-600/85 bg-yellow-500/10 dark:text-yellow-400/90 dark:bg-yellow-500/10 px-2 py-0.5 rounded whitespace-nowrap font-medium tabular-nums ml-auto shrink-0">
              {Math.floor(job.completed_duration / 60).toString().padStart(2, '0')}:{(job.completed_duration % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
        <ResizeHandle colKey="filename" onResize={onResize} disabled={false} />
      </td>
      <td className="px-2 py-2 text-xs text-slate-400 dark:text-zinc-100 overflow-hidden relative" style={{ width: colWidths.destination }}>
        <span onClick={(e) => { e.stopPropagation(); setDestExpanded((v) => !v); }}
          className={clsx('cursor-pointer hover:text-slate-600 dark:hover:text-white/70 transition-colors',
            destExpanded ? 'break-all whitespace-normal block' : 'truncate block')}
          title={destExpanded ? undefined : (getSourceDir(job.filepath) || undefined)}>
          {getSourceDir(job.filepath) || '—'}
        </span>
        <ResizeHandle colKey="destination" onResize={onResize} disabled={false} />
      </td>
      <td className="px-2 py-2 text-xs text-slate-400 dark:text-zinc-100 truncate tabular-nums relative"
        style={{ width: colWidths.size }} title={formatBytes(job.size_bytes)}>
        {formatBytes(job.size_bytes)}
        <ResizeHandle colKey="size" onResize={onResize} disabled={false} />
      </td>
      {audioSubTab !== 'enhance' && (
        <td className="px-1 py-2 relative" style={{ width: colWidths.format }}>
          <FormatSelect job={job} />
          <ResizeHandle colKey="format" onResize={onResize} disabled={false} />
        </td>
      )}
      {audioSubTab === 'separate' && (
        <td className="px-1 py-2 relative" style={{ width: colWidths.bitrate }}>
          <BitrateSelect job={job} />
          <ResizeHandle colKey="bitrate" onResize={onResize} disabled={false} />
        </td>
      )}
      {audioSubTab === 'separate' && (
        <td className="px-1.5 py-2 relative" style={{ width: colWidths.sampleRate }}>
          <SampleRateSelect job={job} />
          <ResizeHandle colKey="sampleRate" onResize={onResize} disabled={false} />
        </td>
      )}
      <td className="px-1.5 py-2 text-xs font-medium whitespace-nowrap text-center relative" style={{ width: colWidths.status }}>
        <StatusBadge status={job.status} progress={job.progress} errorMessage={job.error_message}
          onErrorClick={(e) => { e.stopPropagation(); if (onErrorClick) onErrorClick(job.filename, job.error_message || 'Unknown error occurred during enhancement'); }} />
        <ResizeHandle colKey="status" onResize={onResize} disabled={false} />
      </td>
      <td className="px-1.5 py-2 relative" style={{ width: colWidths.tools }}>
        <div className="flex items-center flex-nowrap gap-1 justify-center">
          {audioSubTab === 'separate' && job.status !== 'done' && job.status !== 'processing' && job.status !== 'queued' && (
            <ToolModeSelect jobId={job.id} audioSubTab={audioSubTab} />
          )}
          {audioSubTab === 'enhance' && <EnhanceRowButton job={job} />}
          {audioSubTab === 'convert' && <ConvertRowButton job={job} />}
          {audioSubTab === 'separate' && (
            rowToolMode === 'enhance' ? <EnhanceRowButton job={job} /> : <ConvertRowButton job={job} />
          )}
          <DownloadJobButton job={job} />
        </div>
        <ResizeHandle colKey="tools" onResize={onResize} disabled={false} />
      </td>
      <td className="px-1 py-2 text-center group/lock relative" style={{ width: colWidths.lock }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (isLocked) unlockJobs([job.id]); else useQueueStore.getState().lockJobs([job.id]); }}
          title={isLocked ? 'Locked — click to unlock' : 'Click to lock'}
          className={clsx('block mx-auto transition-all duration-150 opacity-100',
            isLocked ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/50')}>
          <Lock size={12} />
        </button>
        <ResizeHandle colKey="lock" onResize={onResize} disabled={false} />
      </td>
      <td className="px-1 py-2 text-center group/trash relative" style={{ width: colWidths.clear }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isLocked) return;
            if (job.status === 'processing' || job.status === 'queued') {
              const isIndonesian = useSettingsStore.getState().language === 'id';
              const msg = isIndonesian
                ? 'Apakah Anda yakin ingin menghapus file ini? File ini sedang proses.'
                : 'Are you sure you want to delete this file? The file is currently being processed.';
              if (!window.confirm(msg)) return;
            }
            const tab = useUIStore.getState().audioSubTab;
            useQueueStore.getState().deleteJobs([job.id], tab);
            const activePlayerJobId = useUIStore.getState().activePlayerJobId;
            if (activePlayerJobId === job.id) useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
            void invokeArchiveJobs([job.id]);
          }}
          disabled={isLocked}
          title={isLocked ? 'Cannot delete locked item' : 'Delete item'}
          className={clsx('block mx-auto transition-all duration-150',
            isLocked
              ? 'text-slate-300 dark:text-white/10 cursor-not-allowed opacity-20'
              : 'text-red-500 hover:text-red-400 dark:text-red-500 dark:hover:text-red-400 opacity-100')}>
          <Trash2 size={12} />
        </button>
        <ResizeHandle colKey="clear" onResize={onResize} disabled={false} />
      </td>
    </tr>
  );
}

// ─── Sortable card (grid view) ────────────────────────────────────────────────

function SortableJobCard({ job, isSelected, onSelect, isImporting, activeDragId, onErrorClick, audioSubTab }: {
  job: QueueJob;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  isImporting?: boolean;
  activeDragId: string | null;
  onErrorClick?: (filename: string, errorMessage: string) => void;
  audioSubTab: string;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const selectedJobIds = useQueueStore((s) => s.tabSelectedIds[audioSubTab as 'enhance'|'convert'|'separate']);
  const isDragOfSelectedItem = !!(activeDragId && selectedJobIds.includes(activeDragId));
  const isDraggingAnySelected = isDragOfSelectedItem && selectedJobIds.includes(job.id);
  const isLocked = useQueueStore((s) => s.tabLockedIds[audioSubTab as 'enhance'|'convert'|'separate'].includes(job.id));
  const unlockJobs = useQueueStore((s) => s.unlockJobs);
  const isEnhanced = job.ab_mode === 'enhanced';
  const isSecondaryDrag = isDraggingAnySelected && !isDragging;

  const cardStyle = {
    transform: isDraggingAnySelected ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isDraggingAnySelected ? 0 : undefined,
    display: isSecondaryDrag ? 'none' : undefined,
  };

  return (
    <div ref={setNodeRef} style={cardStyle} onClick={isImporting ? undefined : onSelect} data-job-id={job.id}
      className={clsx('rounded-xl p-3 border transition-all duration-150 select-none',
        isImporting
          ? 'opacity-40 pointer-events-none cursor-default bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.04]'
          : clsx('cursor-pointer', isDragging ? 'scale-[0.98]' : '',
              isSelected ? 'bg-violet-50 dark:bg-violet-500/[0.08] border-violet-300 dark:border-violet-500/40'
                : isEnhanced ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.05] border-emerald-200 dark:border-emerald-500/15 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.08]'
                : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.07] hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.10]'))}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <button {...listeners} {...attributes} onClick={(e) => e.stopPropagation()}
          className="text-slate-300 dark:text-white/20 hover:text-slate-500 dark:hover:text-white/50 transition-colors cursor-grab active:cursor-grabbing shrink-0 mt-0.5" tabIndex={-1}>
          <GripVertical size={14} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0 flex-grow">
          <button onClick={(e) => { e.stopPropagation(); useUIStore.getState().setActivePlayerJobId(job.id); useUIStore.getState().setPlayerOpen(true); }}
            className="p-1 rounded bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 transition shrink-0">
            <Play size={10} fill="currentColor" />
          </button>
          <span className="text-sm text-slate-800 dark:text-slate-100 font-medium truncate flex-1">{job.filename}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); if (isLocked) unlockJobs([job.id]); else useQueueStore.getState().lockJobs([job.id]); }}
            title={isLocked ? 'Locked — click to unlock' : 'Click to lock'}
            className={clsx('transition-all duration-150 opacity-100',
              isLocked ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/50')}>
            <Lock size={12} />
          </button>
          <span onClick={() => { if (job.status === 'error' && job.error_message && onErrorClick) onErrorClick(job.filename, job.error_message); }}
            className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize',
              STATUS_BADGE_CLS[job.status], job.status === 'error' && 'cursor-pointer hover:bg-red-500/20 active:scale-95 transition-all')}>
            {job.status === 'processing' && <span className="w-1 h-1 rounded-full bg-amber-400 status-processing-dot" />}
            {job.status}
          </span>
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
          <motion.div className="h-full rounded-full bg-violet-500" initial={{ width: 0 }}
            animate={{ width: `${job.progress}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
        </div>
      )}
    </div>
  );
}

// ─── Main QueueGrid ───────────────────────────────────────────────────────────

export default function QueueGrid(): JSX.Element {
  const activeTab = useUIStore((s) => s.activeTab);
  const audioSubTab = useUIStore((s) => s.audioSubTab);
  const jobs = useQueueStore((s) => s.filteredJobs(audioSubTab, activeTab));
  const groups = useQueueStore((s) => s.groupedFilteredJobs(audioSubTab, activeTab));
  const setProgress = useQueueStore((s) => s.setProgress);
  const setStatus = useQueueStore((s) => s.setStatus);
  const setOutputFilepath = useQueueStore((s) => s.setOutputFilepath);
  const setAbMode = useQueueStore((s) => s.setAbMode);
  const reorderJobs = useQueueStore((s) => s.reorderJobs);
  const selectedJobIds = useQueueStore((s) => s.tabSelectedIds[audioSubTab]);
  const { setSelectedJob, toggleSelectJob, rangeSelectJobs } = useQueueStore();
  const viewMode = useQueueStore((s) => s.tabViewModes[audioSubTab]);
  const groupByFormat = useQueueStore((s) => s.tabGroupByFormat[audioSubTab]);
  const clearSelection = useQueueStore((s) => s.clearSelection);
  const { t } = useTranslation();

  // ── Resizable columns ──────────────────────────────────────────────────────
  // Column sizes are now locked to their correct predefined values.
  const allColWidths = useMemo<Record<string, Record<ColKey, number>>>(() => ({
    enhance: { ...ENHANCE_COL_WIDTHS },
    convert: { ...CONVERT_COL_WIDTHS },
    separate: { ...DEFAULT_COL_WIDTHS },
  }), []);

  const colWidths = allColWidths[audioSubTab] || DEFAULT_COL_WIDTHS;

  // Resizing is disabled, but keep signature to avoid breaking other components
  const handleResize = useCallback((_key: ColKey, _delta: number) => {
    // Locked
  }, []);

  const { addToast } = useToastStore();

  const copyWidthLog = useCallback(() => {
    let outputWidths: any = { ...colWidths };
    
    if (audioSubTab === 'enhance') {
      delete outputWidths.format;
      delete outputWidths.bitrate;
      delete outputWidths.sampleRate;
    } else if (audioSubTab === 'convert') {
      delete outputWidths.bitrate;
      delete outputWidths.sampleRate;
      outputWidths['saveTo'] = outputWidths.format;
      delete outputWidths.format;
    }

    const total = Object.values(outputWidths).reduce((a: any, b: any) => a + b, 0);
    const log = JSON.stringify({ ...outputWidths, total }, null, 2);
    void navigator.clipboard.writeText(log);
    const isIndonesian = useSettingsStore.getState().language === 'id';
    addToast(
      isIndonesian ? 'Log ukuran kolom berhasil disalin!' : 'Column width log copied to clipboard!',
      'success'
    );
  }, [colWidths, audioSubTab, addToast]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const importingJobIds = useQueueStore((s) => s.tabImportingIds[audioSubTab]);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [errorDetailModal, setErrorDetailModal] = useState<{ filename: string; errorMessage: string } | null>(null);

  const handleErrorClick = (filename: string, errorMessage: string): void => {
    setErrorDetailModal({ filename, errorMessage });
  };

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
    return groups
      .map((g) => ({ ...g, jobs: g.jobs.filter((j) => j.id === activeDragId || !dragSelectedIds.includes(j.id)) }))
      .filter((g) => g.jobs.length > 0);
  }, [groups, activeDragId, dragSelectedIds]);

  const draggingJobs = useMemo((): QueueJob[] => {
    if (!activeDragId) return [];
    const ids = selectedJobIds.includes(activeDragId) ? selectedJobIds : [activeDragId];
    return ids.map((id) => jobs.find((j) => j.id === id)).filter((j): j is QueueJob => j !== undefined);
  }, [activeDragId, selectedJobIds, jobs]);

  async function handleClearQueue(): Promise<void> {
    const tab = useUIStore.getState().audioSubTab;
    const { tabQueues, tabLockedIds, clearQueue } = useQueueStore.getState();
    const tabJobs = tabQueues[tab];
    const lockedIds = tabLockedIds[tab];
    const idsToArchive = tabJobs.filter((j) => !lockedIds.includes(j.id)).map((j) => j.id);
    const activePlayerJobId = useUIStore.getState().activePlayerJobId;
    if (activePlayerJobId && idsToArchive.includes(activePlayerJobId)) {
      useUIStore.setState({ activePlayerJobId: null, playerOpen: false });
    }
    clearQueue(tab);
    if (idsToArchive.length > 0) void invokeArchiveJobs(idsToArchive);
  }

  function handleContainerMouseDown(e: React.MouseEvent): void {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let dragStarted = false;

    const onMouseMove = (ev: MouseEvent): void => {
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
          const intersects = left < box.right && left + width > box.left && top < box.bottom && top + height > box.top;
          if (intersects) intersectedIds.push(jobId);
        });
        const { tabSelectedIds } = useQueueStore.getState();
        const curTab = useUIStore.getState().audioSubTab;
        const curSelected = tabSelectedIds[curTab];
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
          useQueueStore.setState((s) => ({
            tabSelectedIds: { ...s.tabSelectedIds, [curTab]: [...new Set([...curSelected, ...intersectedIds])] },
          }));
        } else {
          useQueueStore.setState((s) => ({
            tabSelectedIds: { ...s.tabSelectedIds, [curTab]: intersectedIds },
          }));
        }
      }
    };

    const onMouseUp = (): void => {
      setSelectionBox(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
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
      (e) => setProgress(e.payload.jobId, e.payload.percent),
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

        // Toast
        const job = useQueueStore.getState().getJobById(jobId);
        const filename = job?.filename ?? jobId;
        const { addToast } = useToastStore.getState();
        if (status === 'done') {
          addToast(`"${filename}" enhanced successfully`, 'success');
        } else if (status === 'error') {
          console.error(`Error enhancing "${filename}":`, error_message);
          addToast(`Error: ${error_message || 'Failed to enhance ' + filename}`, 'error');
          logError('Enhancement', `Failed to enhance "${filename}"`, error_message ?? undefined);
        }

        // Auto-advance within the same tab
        if (status === 'done' || status === 'error' || status === 'pending') {
          setTimeout(() => {
            const jobTab = useQueueStore.getState().findJobTab(jobId);
            if (!jobTab) return;
            const { tabQueues, tabJobOpTypes } = useQueueStore.getState();
            const tabJobs = tabQueues[jobTab];
            const isAnyProcessing = tabJobs.some((j) => j.status === 'processing');
            if (!isAnyProcessing) {
              const nextQueued = tabJobs.find((j) => j.status === 'queued');
              if (nextQueued) {
                const opType = tabJobOpTypes[jobTab][nextQueued.id] ?? 'enhance';
                const { aiModel, enhancementStrength, filenameTemplate } = useSettingsStore.getState();
                if (opType === 'enhance') {
                  invokeProcessQueue([nextQueued.id], enhancementStrength, aiModel).catch(console.error);
                } else {
                  invokeConvertFiles([nextQueued.id], filenameTemplate).catch(console.error);
                }
              }
            }
          }, 100);
        }
      },
    );
    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [setProgress, setStatus, setOutputFilepath, setAbMode]);

  function handleRowClick(e: React.MouseEvent, jobId: string): void {
    if (e.shiftKey) {
      rangeSelectJobs(jobId, audioSubTab);
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelectJob(jobId, audioSubTab);
    } else {
      setSelectedJob(
        selectedJobIds.length === 1 && selectedJobIds[0] === jobId ? null : jobId,
        audioSubTab,
      );
    }
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderJobs(String(active.id), String(over.id), audioSubTab);
    }
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <p className="text-slate-400 dark:text-white/25 text-sm">{t('queue.empty')}</p>
    </div>
  );

  const dragOverlayContent = activeDragId && draggingJobs.length > 0 && (
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
  );

  if (viewMode === 'grid') {
    return (
      <>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-auto scrollbar-thin" onMouseDown={handleContainerMouseDown}
            onClick={(e) => { if (e.target === e.currentTarget) clearSelection(audioSubTab); }}>
            {jobs.length === 0 ? emptyState : groupByFormat ? (
              <div className="flex flex-col gap-4 p-1">
                {visibleGroups.map((group) => (
                  <div key={group.label}>
                    <button onClick={() => toggleGroup(group.label)}
                      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/35 px-1 pb-2 border-b border-slate-200 dark:border-white/[0.07] mb-2 w-full hover:text-slate-700 dark:hover:text-white/60 transition-colors">
                      <ChevronRight size={11} className={`transition-transform shrink-0 ${collapsedGroups.has(group.label) ? '' : 'rotate-90'}`} />
                      {group.label}
                      <span className="text-slate-300 dark:text-white/20 font-normal ml-0.5">({group.jobs.length})</span>
                    </button>
                    {!collapsedGroups.has(group.label) && (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={[restrictToFirstScrollableAncestor]}>
                        <SortableContext items={group.jobs.map((j) => j.id)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-3 gap-2" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(audioSubTab); }}>
                            {group.jobs.map((job) => (
                              <SortableJobCard key={job.id} job={job} isSelected={selectedJobIds.includes(job.id)}
                                onSelect={(e) => handleRowClick(e, job.id)} isImporting={importingJobIds.includes(job.id)}
                                activeDragId={activeDragId} onErrorClick={handleErrorClick} audioSubTab={audioSubTab} />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay dropAnimation={null}>
                          {activeDragId && draggingJobs.length > 0 && (
                            <div className="relative select-none w-[220px]">
                              {draggingJobs.length > 1 && <div className="absolute left-2 top-2 w-full h-full rounded-xl bg-violet-400/15 border border-violet-300/25" />}
                              <div className="relative rounded-xl p-3 bg-white dark:bg-[#0D1525] border border-violet-400/50 shadow-xl shadow-violet-500/15">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{draggingJobs[0].filename}</span>
                                <span className="text-[10px] text-slate-400 dark:text-white/35 mt-1 block">{formatBytes(draggingJobs[0].size_bytes)}</span>
                                {draggingJobs.length > 1 && <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md">{draggingJobs.length}</span>}
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={[restrictToFirstScrollableAncestor]}>
                <SortableContext items={visibleJobs.map((j) => j.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 gap-2 p-1" onClick={(e) => { if (e.target === e.currentTarget) clearSelection(audioSubTab); }}>
                    {visibleJobs.map((job) => (
                      <SortableJobCard key={job.id} job={job} isSelected={selectedJobIds.includes(job.id)}
                        onSelect={(e) => handleRowClick(e, job.id)} isImporting={importingJobIds.includes(job.id)}
                        activeDragId={activeDragId} onErrorClick={handleErrorClick} audioSubTab={audioSubTab} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragId && draggingJobs.length > 0 && (
                    <div className="relative select-none w-[220px]">
                      {draggingJobs.length > 1 && <div className="absolute left-2 top-2 w-full h-full rounded-xl bg-violet-400/15 border border-violet-300/25" />}
                      <div className="relative rounded-xl p-3 bg-white dark:bg-[#0D1525] border border-violet-400/50 shadow-xl shadow-violet-500/15">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{draggingJobs[0].filename}</span>
                        <span className="text-[10px] text-slate-400 dark:text-white/35 mt-1 block">{formatBytes(draggingJobs[0].size_bytes)}</span>
                        {draggingJobs.length > 1 && <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md">{draggingJobs.length}</span>}
                      </div>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </div>
          <QueueActionBar />
        </div>
        {selectionBox && (
          <div className="fixed z-50 pointer-events-none border border-violet-500 bg-violet-500/10 rounded"
            style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }} />
        )}
      </>
    );
  }

  // ── Table header ──────────────────────────────────────────────────────────

  const tableHeader = (
    <thead>
      <tr className="text-slate-500 dark:text-zinc-100 font-semibold text-[10px] uppercase tracking-wider sticky top-0 bg-slate-50 dark:bg-[#090E1B] border-b-2 border-slate-200 dark:border-white/[0.08] z-10">
        <th className="px-1 py-2.5 text-center relative" style={{ width: colWidths.grip }}>
          <ResizeHandle colKey="grip" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-1 py-2.5 text-center relative" style={{ width: colWidths.index }}>
          #
          <ResizeHandle colKey="index" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-2 py-2.5 text-left relative" style={{ width: colWidths.filename }}>
          <span className="px-2">{t('queue.col.filename')}</span>
          <ResizeHandle colKey="filename" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-2 py-2.5 text-left relative" style={{ width: colWidths.destination }}>
          <span className="px-2">{t('queue.col.destination')}</span>
          <ResizeHandle colKey="destination" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-2 py-2.5 text-left relative" style={{ width: colWidths.size }}>
          <span className="px-2">{t('queue.col.size')}</span>
          <ResizeHandle colKey="size" onResize={handleResize} disabled={false} />
        </th>
        {audioSubTab !== 'enhance' && (
          <th className="px-1 py-2.5 text-center relative" style={{ width: colWidths.format }}>
            <span>{audioSubTab === 'convert' ? 'Save to' : t('queue.col.output')}</span>
            <ResizeHandle colKey="format" onResize={handleResize} disabled={false} />
          </th>
        )}
        {audioSubTab === 'separate' && (
          <th className="px-1 py-2.5 text-center relative" style={{ width: colWidths.bitrate }}>
            <span>{t('queue.col.bitrate')}</span>
            <ResizeHandle colKey="bitrate" onResize={handleResize} disabled={false} />
          </th>
        )}
        {audioSubTab === 'separate' && (
          <th className="px-1.5 py-2.5 text-center whitespace-nowrap relative" style={{ width: colWidths.sampleRate }}>
            <span>{t('queue.col.sampleHz')}</span>
            <ResizeHandle colKey="sampleRate" onResize={handleResize} disabled={false} />
          </th>
        )}
        <th className="px-1.5 py-2.5 text-center whitespace-nowrap relative" style={{ width: colWidths.status }}>
          <span>{t('queue.col.status')}</span>
          <ResizeHandle colKey="status" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-1.5 py-2.5 text-center relative" style={{ width: colWidths.tools }}>
          <div className="flex items-center justify-center gap-2">
            <span>TOOLS</span>
            {audioSubTab !== 'enhance' && audioSubTab !== 'convert' && (
              <button onClick={copyWidthLog} title="Copy column width log to clipboard"
                className="text-slate-300 dark:text-white/20 hover:text-violet-500 dark:hover:text-violet-400 transition-colors">
                <Copy size={9} />
              </button>
            )}
          </div>
          <ResizeHandle colKey="tools" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-1 py-2.5 text-center relative" style={{ width: colWidths.lock }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const tab = useUIStore.getState().audioSubTab;
              const { tabQueues, tabLockedIds, lockAllJobs, unlockAllJobs } = useQueueStore.getState();
              const tabJobs = tabQueues[tab];
              const lockedIds = tabLockedIds[tab];
              if (lockedIds.length === tabJobs.length && tabJobs.length > 0) unlockAllJobs(tab);
              else lockAllJobs(tab);
            }}
            title="Lock / Unlock all items"
            className="text-slate-400 dark:text-zinc-100 hover:text-violet-500 dark:hover:text-violet-400 transition-colors">
            <Lock size={11} className="mx-auto" />
          </button>
          <ResizeHandle colKey="lock" onResize={handleResize} disabled={false} />
        </th>
        <th className="px-1 py-2.5 text-center relative" style={{ width: colWidths.clear }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const tab = useUIStore.getState().audioSubTab;
              const { tabQueues, tabLockedIds } = useQueueStore.getState();
              const nonLocked = tabQueues[tab].filter((j) => !tabLockedIds[tab].includes(j.id));
              const hasProcessing = nonLocked.some((j) => j.status === 'processing' || j.status === 'queued');
              if (hasProcessing) {
                const isIndonesian = useSettingsStore.getState().language === 'id';
                const msg = isIndonesian
                  ? 'Apakah Anda yakin ingin menghapus? File sedang diproses.'
                  : 'Are you sure you want to delete? File is currently being processed.';
                if (!window.confirm(msg)) return;
              }
              setShowClearConfirm(true);
            }}
            className="text-red-500 hover:text-red-400 font-semibold text-[10px] uppercase tracking-wider transition-colors"
            title="Clear all non-locked items">
            Clear
          </button>
          <ResizeHandle colKey="clear" onResize={handleResize} disabled={false} />
        </th>
      </tr>
    </thead>
  );

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        <div ref={tableContainerRef}
          className="flex-1 overflow-y-scroll overflow-x-auto rounded-xl bg-white dark:bg-[#0C1120] shadow-sm border border-slate-200 dark:border-white/[0.06] scrollbar-thin"
          onMouseDown={handleContainerMouseDown}
          onClick={(e) => { if ((e.target as HTMLElement).closest('tr') === null) clearSelection(audioSubTab); }}>
          <table className="text-left queue-table table-fixed w-full" style={{ minWidth: Math.max(800, colWidths.grip + colWidths.index + colWidths.filename + colWidths.destination + colWidths.size + colWidths.status + colWidths.tools + colWidths.lock + colWidths.clear + (audioSubTab === 'convert' ? colWidths.format : audioSubTab === 'separate' ? colWidths.format + colWidths.bitrate + colWidths.sampleRate : 0)) }}>
            <colgroup>
              <col style={{ width: colWidths.grip }} />
              <col style={{ width: colWidths.index }} />
              <col style={{ width: colWidths.filename }} />
              <col style={{ width: colWidths.destination }} />
              <col style={{ width: colWidths.size }} />
              {audioSubTab === 'convert' && <col style={{ width: colWidths.format }} />}
              {audioSubTab === 'separate' && <col style={{ width: colWidths.format }} />}
              {audioSubTab === 'separate' && <col style={{ width: colWidths.bitrate }} />}
              {audioSubTab === 'separate' && <col style={{ width: colWidths.sampleRate }} />}
              <col style={{ width: colWidths.status }} />
              <col style={{ width: colWidths.tools }} />
              <col style={{ width: colWidths.lock }} />
              <col style={{ width: colWidths.clear }} />
            </colgroup>
            {tableHeader}
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={audioSubTab === 'enhance' ? 9 : (audioSubTab === 'convert' ? 10 : 12)} className="px-4 py-16 text-center text-slate-400 dark:text-white/25 text-sm">
                    {t('queue.empty')}
                  </td>
                </tr>
              ) : groupByFormat ? (
                <>
                  {visibleGroups.map((group, gi) => (
                    <React.Fragment key={`group-${gi}`}>
                      <tr>
                        <td colSpan={audioSubTab === 'enhance' ? 9 : (audioSubTab === 'convert' ? 10 : 12)} className="px-4 pt-3 pb-1">
                          <button onClick={() => toggleGroup(group.label)}
                            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400/80 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
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
                                <SortableJobRow key={job.id} job={job}
                                  index={groups.find((g) => g.label === group.label)?.jobs.findIndex((j) => j.id === job.id) ?? i}
                                  isSelected={selectedJobIds.includes(job.id)} onSelect={(e) => handleRowClick(e, job.id)}
                                  isImporting={importingJobIds.includes(job.id)} activeDragId={activeDragId}
                                  onErrorClick={handleErrorClick} colWidths={colWidths} onResize={handleResize} audioSubTab={audioSubTab} />
                              ))}
                            </AnimatePresence>
                          </SortableContext>
                          <DragOverlay dropAnimation={null}>{dragOverlayContent}</DragOverlay>
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
                        <SortableJobRow key={job.id} job={job} index={jobs.findIndex((j) => j.id === job.id)}
                          isSelected={selectedJobIds.includes(job.id)} onSelect={(e) => handleRowClick(e, job.id)}
                          isImporting={importingJobIds.includes(job.id)} activeDragId={activeDragId}
                          onErrorClick={handleErrorClick} colWidths={colWidths} onResize={handleResize} audioSubTab={audioSubTab} />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                  <DragOverlay dropAnimation={null}>{dragOverlayContent}</DragOverlay>
                </DndContext>
              )}
            </tbody>
          </table>
        </div>
        <QueueActionBar />
      </div>

      {selectionBox && (
        <div className="fixed z-50 pointer-events-none border border-violet-500 bg-violet-500/10 rounded"
          style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }} />
      )}

      {showClearConfirm && (() => {
        const tab = useUIStore.getState().audioSubTab;
        const { tabQueues, tabLockedIds } = useQueueStore.getState();
        const nonLocked = tabQueues[tab].filter((j) => !tabLockedIds[tab].includes(j.id));
        const hasProcessing = nonLocked.some((j) => j.status === 'processing' || j.status === 'queued');
        const isIndonesian = useSettingsStore.getState().language === 'id';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Confirm Clear Queue</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                {isIndonesian
                  ? 'Apakah Anda yakin ingin menghapus seluruh antrean? File yang terkunci tidak akan dihapus.'
                  : 'Are you sure you want to clear the entire queue? Locked files will not be deleted.'}
              </p>
              {hasProcessing && (
                <p className="text-xs text-red-400 font-semibold leading-relaxed">
                  {isIndonesian ? 'Peringatan: Beberapa file sedang diproses!' : 'Warning: Some files are currently being processed!'}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white transition-colors">
                  Cancel
                </button>
                <button onClick={async () => { setShowClearConfirm(false); await handleClearQueue(); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors">
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {errorDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setErrorDetailModal(null)}>
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider">Enhancement Error Details</h3>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/45 uppercase font-medium">File</span>
              <span className="text-xs text-white font-medium truncate">{errorDetailModal.filename}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/45 uppercase font-medium">Error Message</span>
              <div className="bg-black/40 border border-white/5 p-3 rounded-lg max-h-48 overflow-y-auto scrollbar-thin">
                <code className="text-xs text-red-400 font-mono break-all leading-relaxed whitespace-pre-wrap">{errorDetailModal.errorMessage}</code>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setErrorDetailModal(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
