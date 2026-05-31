import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { GripVertical, Play, Pause, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueueStore } from '@/stores/useQueueStore';
import { useAudioPlayer } from '@/stores/useAudioPlayer';
import { invokeSetOutputFormat, invokeSetBitrate, invokeSetSampleRate } from '@/lib/ipc';
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

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];
const BITRATE_OPTIONS = ['', '64k', '96k', '128k', '192k', '256k', '320k'];
const SAMPLE_RATE_OPTIONS = ['', '22050', '44100', '48000', '96000'];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function ProgressBar({ percent }: { percent: number }): JSX.Element {
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-blue-400"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}

function FormatSelect({ job }: { job: QueueJob }): JSX.Element {
  const setOutputFormat = useQueueStore((s) => s.setOutputFormat);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    e.stopPropagation();
    const fmt = e.target.value;
    setOutputFormat(job.id, fmt);
    await invokeSetOutputFormat(job.id, fmt);
  }

  return (
    <select
      value={job.output_format}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={job.status !== 'pending'}
      className="bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-white text-xs rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition"
    >
      {FORMAT_OPTIONS.map((f) => (
        <option key={f} value={f} className="bg-neutral-800">{f.toUpperCase()}</option>
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
    <select
      value={job.bitrate || ''}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={job.status !== 'pending'}
      className="bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-white text-xs rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition"
    >
      {BITRATE_OPTIONS.map((b) => (
        <option key={b} value={b} className="bg-neutral-800">{b || 'Auto'}</option>
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
    <select
      value={job.sample_rate || ''}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={job.status !== 'pending'}
      className="bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-white text-xs rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition"
    >
      {SAMPLE_RATE_OPTIONS.map((r) => (
        <option key={r} value={r} className="bg-neutral-800">{r ? `${r} Hz` : 'Auto'}</option>
      ))}
    </select>
  );
}

function SortableJobRow({ job, index, isSelected, onSelect }: {
  job: QueueJob;
  index: number;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const { playingJobId, isPlaying, toggle } = useAudioPlayer();
  const setAbMode = useQueueStore((s) => s.setAbMode);

  const isThisPlaying = playingJobId === job.id && isPlaying;
  const isEnhanced = job.ab_mode === 'enhanced';

  function getPlaySrc(): string {
    return isEnhanced && job.output_filepath ? job.output_filepath : job.filepath;
  }

  function handlePlay(e: React.MouseEvent): void {
    e.stopPropagation();
    toggle(job.id, getPlaySrc());
  }

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={clsx(
        'border-b border-zinc-100 dark:border-white/5 cursor-pointer transition-colors select-none',
        isDragging ? 'opacity-40 bg-violet-600/10' : '',
        isSelected
          ? 'bg-violet-600/20 border-violet-500/30 hover:bg-violet-600/25'
          : isEnhanced
            ? 'bg-blue-500/[0.12] hover:bg-blue-500/[0.18]'
            : 'hover:bg-zinc-50 dark:hover:bg-white/5',
      )}
    >
      <td className="px-2 py-2 w-8">
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="text-zinc-300 dark:text-white/20 hover:text-zinc-500 dark:hover:text-white/60 transition-colors cursor-grab active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="px-2 py-2 w-8">
        <button
          onClick={handlePlay}
          className={clsx(
            'flex items-center justify-center w-6 h-6 rounded-full transition-colors',
            isThisPlaying
              ? 'text-blue-400 hover:text-blue-300'
              : 'text-zinc-300 dark:text-white/25 hover:text-zinc-600 dark:hover:text-white/70',
          )}
          aria-label={isThisPlaying ? 'Pause' : 'Play'}
        >
          {isThisPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>
      </td>
      <td className="px-4 py-2 text-zinc-400 dark:text-white/30 text-xs w-10">{index + 1}</td>
      <td className="px-4 py-2 text-sm text-zinc-800 dark:text-white truncate max-w-[180px]">{job.filename}</td>
      <td
        className="px-2 py-2 text-xs text-zinc-500 dark:text-white/50 truncate max-w-[130px] group/dest"
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
          <span className="truncate">{job.destination || '—'}</span>
        </button>
      </td>
      <td className="px-4 py-2 text-xs text-zinc-500 dark:text-white/50 w-20">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-zinc-400 dark:text-white/40 w-16">{job.media_type}</td>
      <td className="px-4 py-2 w-24">
        <FormatSelect job={job} />
      </td>
      <td className="px-4 py-2 w-24">
        <BitrateSelect job={job} />
      </td>
      <td className="px-4 py-2 w-24">
        <SampleRateSelect job={job} />
      </td>
      <td className="px-4 py-2 text-xs font-medium w-40">
        {job.status === 'done' && job.output_filepath ? (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAbMode(job.id, 'enhanced');
                toggle(job.id, job.output_filepath!);
              }}
              className={clsx(
                'px-1.5 py-0.5 rounded text-[11px] transition-colors',
                isEnhanced
                  ? 'bg-blue-500/30 text-blue-300 font-semibold'
                  : 'text-zinc-400 dark:text-white/40 hover:bg-zinc-100 dark:hover:bg-white/10',
              )}
            >
              Enhanced
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAbMode(job.id, 'original');
                toggle(job.id, job.filepath);
              }}
              className={clsx(
                'px-1.5 py-0.5 rounded text-[11px] transition-colors',
                !isEnhanced
                  ? 'bg-zinc-200 dark:bg-white/15 text-zinc-700 dark:text-white/80 font-semibold'
                  : 'text-zinc-400 dark:text-white/40 hover:bg-zinc-100 dark:hover:bg-white/10',
              )}
            >
              Original
            </button>
          </div>
        ) : (
          <>
            <span
              className={STATUS_COLORS[job.status]}
              title={job.status === 'error' ? (job.error_message ?? undefined) : undefined}
            >
              {job.status}
            </span>
            {job.status === 'processing' && <ProgressBar percent={job.progress} />}
          </>
        )}
      </td>
    </tr>
  );
}

function SortableJobCard({ job, isSelected, onSelect }: {
  job: QueueJob;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const { playingJobId, isPlaying, toggle } = useAudioPlayer();
  const setAbMode = useQueueStore((s) => s.setAbMode);

  const isThisPlaying = playingJobId === job.id && isPlaying;
  const isEnhanced = job.ab_mode === 'enhanced';

  function handlePlay(e: React.MouseEvent): void {
    e.stopPropagation();
    const src = isEnhanced && job.output_filepath ? job.output_filepath : job.filepath;
    toggle(job.id, src);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={clsx(
        'rounded-xl p-3 border cursor-pointer transition-colors select-none',
        isDragging ? 'opacity-40' : '',
        isSelected
          ? 'bg-violet-600/20 border-violet-500/40'
          : isEnhanced
            ? 'bg-blue-500/[0.12] border-blue-500/20 hover:bg-blue-500/[0.18]'
            : 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/[0.08]',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="text-zinc-300 dark:text-white/20 hover:text-zinc-500 dark:hover:text-white/60 transition-colors cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <span className="text-sm text-zinc-800 dark:text-white font-medium truncate flex-1">{job.filename}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handlePlay}
            className={clsx(
              'flex items-center justify-center w-5 h-5 rounded-full transition-colors',
              isThisPlaying ? 'text-blue-400' : 'text-zinc-300 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/70',
            )}
            aria-label={isThisPlaying ? 'Pause' : 'Play'}
          >
            {isThisPlaying ? <Pause size={11} /> : <Play size={11} />}
          </button>
          {job.status === 'done' && job.output_filepath ? (
            <div className="flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setAbMode(job.id, 'enhanced'); toggle(job.id, job.output_filepath!); }}
                className={clsx('px-1 py-0.5 rounded text-[10px] transition-colors', isEnhanced ? 'bg-blue-500/30 text-blue-300' : 'text-zinc-400 dark:text-white/40 hover:bg-zinc-100 dark:hover:bg-white/10')}
              >Enh</button>
              <button
                onClick={(e) => { e.stopPropagation(); setAbMode(job.id, 'original'); toggle(job.id, job.filepath); }}
                className={clsx('px-1 py-0.5 rounded text-[10px] transition-colors', !isEnhanced ? 'bg-zinc-200 dark:bg-white/15 text-zinc-700 dark:text-white/80' : 'text-zinc-400 dark:text-white/40 hover:bg-zinc-100 dark:hover:bg-white/10')}
              >Orig</button>
            </div>
          ) : (
            <span className={clsx('text-xs font-medium capitalize', STATUS_COLORS[job.status])}>
              {job.status}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-white/40">
        <span>{formatBytes(job.size_bytes)}</span>
        <span className="uppercase">{job.media_type}</span>
        <span className="uppercase">{job.output_format}</span>
        {job.bitrate && <span>{job.bitrate}</span>}
      </div>
      {job.status === 'processing' && <ProgressBar percent={job.progress} />}
    </div>
  );
}

export default function QueueGrid(): JSX.Element {
  const jobs = useQueueStore((s) => s.filteredJobs());
  const groups = useQueueStore((s) => s.groupedFilteredJobs());
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
  const adjustWidth = (col: keyof typeof colWidths, delta: number): void =>
    setColWidths((p) => ({ ...p, [col]: Math.max(80, p[col] + delta) }));

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

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderJobs(String(active.id), String(over.id));
    }
  }

  if (viewMode === 'grid') {
    return (
      <div
        className="flex-1 overflow-auto"
        onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
      >
        {jobs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-400 dark:text-white/30 text-sm">
            {t('queue.empty')}
          </div>
        ) : groupByFormat ? (
          <div className="flex flex-col gap-4 p-1">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold uppercase text-zinc-400 dark:text-white/40 px-1 pb-1.5 border-b border-zinc-200 dark:border-white/10 mb-2">
                  {group.label} <span className="text-zinc-300 dark:text-white/25 font-normal">({group.jobs.length})</span>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={jobs.map((j) => j.id)} strategy={rectSortingStrategy}>
              <div
                className="grid grid-cols-3 gap-2 p-1"
                onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
              >
                {jobs.map((job) => (
                  <SortableJobCard
                    key={job.id}
                    job={job}
                    isSelected={selectedJobIds.includes(job.id)}
                    onSelect={(e) => handleRowClick(e, job.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    );
  }

  const tableHeader = (
    <thead>
      <tr className="border-b border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-white/40 text-xs uppercase tracking-wider sticky top-0 bg-zinc-50/90 dark:bg-neutral-900/80 backdrop-blur">
        <th className="px-2 py-2 w-8" />
        <th className="px-2 py-2 w-8" />
        <th className="px-4 py-2 w-10">#</th>
        <th className="resizable-th px-2 py-2 text-left" style={{ width: colWidths.filename, minWidth: 80 }}>
          <span className="px-2">{t('queue.col.filename')}</span>
          <ResizeHandle onDelta={(d) => adjustWidth('filename', d)} />
        </th>
        <th className="resizable-th px-2 py-2 text-left" style={{ width: colWidths.destination, minWidth: 80 }}>
          <span className="px-2">{t('queue.col.destination')}</span>
          <ResizeHandle onDelta={(d) => adjustWidth('destination', d)} />
        </th>
        <th className="px-4 py-2 w-20">{t('queue.col.size')}</th>
        <th className="px-4 py-2 w-16">{t('queue.col.type')}</th>
        <th className="px-4 py-2 w-24">{t('queue.col.output')}</th>
        <th className="px-4 py-2 w-24">{t('queue.col.bitrate')}</th>
        <th className="px-4 py-2 w-28 whitespace-nowrap">{t('queue.col.sampleHz')}</th>
        <th className="px-4 py-2 w-40">{t('queue.col.status')}</th>
      </tr>
    </thead>
  );

  return (
    <div
      className="flex-1 overflow-auto rounded-xl bg-zinc-50 dark:bg-white/5"
      onClick={(e) => { if ((e.target as HTMLElement).closest('tr') === null) clearSelection(); }}
    >
      <table className="w-full text-left">
        {tableHeader}
        <tbody>
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-16 text-center text-zinc-400 dark:text-white/30 text-sm">
                {t('queue.empty')}
              </td>
            </tr>
          ) : groupByFormat ? (
            <>
              {groups.map((group, gi) => (
                <>
                  <tr key={`group-${gi}`}>
                    <td colSpan={11} className="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-violet-500 dark:text-violet-400/70">
                      {group.label} <span className="text-zinc-300 dark:text-white/25 font-normal">({group.jobs.length})</span>
                    </td>
                  </tr>
                  <DndContext key={`dnd-${gi}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={group.jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                      <AnimatePresence>
                        {group.jobs.map((job, i) => (
                          <SortableJobRow
                            key={job.id}
                            job={job}
                            index={i}
                            isSelected={selectedJobIds.includes(job.id)}
                            onSelect={(e) => handleRowClick(e, job.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </SortableContext>
                  </DndContext>
                </>
              ))}
            </>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence>
                  {jobs.map((job, i) => (
                    <SortableJobRow
                      key={job.id}
                      job={job}
                      index={i}
                      isSelected={selectedJobIds.includes(job.id)}
                      onSelect={(e) => handleRowClick(e, job.id)}
                    />
                  ))}
                </AnimatePresence>
              </SortableContext>
            </DndContext>
          )}
        </tbody>
      </table>
    </div>
  );
}
