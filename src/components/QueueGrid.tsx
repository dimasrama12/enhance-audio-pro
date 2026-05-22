import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeSetOutputFormat } from '@/lib/ipc';
import type { QueueJob, JobStatus } from '@/types/queue';

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function ProgressBar({ percent }: { percent: number }): JSX.Element {
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
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
      className="bg-white/10 text-white text-xs rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition"
    >
      {FORMAT_OPTIONS.map((f) => (
        <option key={f} value={f} className="bg-neutral-800">
          {f.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

function JobRow({ job, index, isSelected, onSelect }: {
  job: QueueJob;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <motion.tr
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onSelect}
      className={clsx(
        'border-b border-white/5 cursor-pointer transition-colors',
        isSelected
          ? 'bg-violet-600/20 border-violet-500/30 hover:bg-violet-600/25'
          : 'hover:bg-white/5',
      )}
    >
      <td className="px-4 py-2 text-white/30 text-xs w-10">{index + 1}</td>
      <td className="px-4 py-2 text-sm text-white truncate max-w-[180px]">{job.filename}</td>
      <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[130px]">{job.destination || '—'}</td>
      <td className="px-4 py-2 text-xs text-white/50 w-20">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-white/40 w-16">{job.media_type}</td>
      <td className="px-4 py-2 w-28">
        <FormatSelect job={job} />
      </td>
      <td className={clsx('px-4 py-2 text-xs font-medium capitalize w-36', STATUS_COLORS[job.status])}>
        <span title={job.status === 'error' ? (job.error_message ?? undefined) : undefined}>
          {job.status}
        </span>
        {job.status === 'processing' && <ProgressBar percent={job.progress} />}
      </td>
    </motion.tr>
  );
}

export default function QueueGrid(): JSX.Element {
  const jobs = useQueueStore((s) => s.filteredJobs());
  const setProgress = useQueueStore((s) => s.setProgress);
  const setStatus = useQueueStore((s) => s.setStatus);
  const selectedJobId = useQueueStore((s) => s.selectedJobId);
  const setSelectedJob = useQueueStore((s) => s.setSelectedJob);

  useEffect(() => {
    const unlistenProgress = listen<{ jobId: string; percent: number }>(
      'queue://progress',
      (event) => setProgress(event.payload.jobId, event.payload.percent)
    );
    const unlistenStatus = listen<{ jobId: string; status: string; error_message?: string }>(
      'queue://status-change',
      (event) => {
        const { jobId, status, error_message } = event.payload;
        setStatus(jobId, status as JobStatus, error_message);
      }
    );
    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [setProgress, setStatus]);

  return (
    <div className="flex-1 overflow-auto rounded-xl bg-white/5">
      <table className="w-full text-left table-fixed">
        <thead>
          <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider sticky top-0 bg-neutral-900/80 backdrop-blur">
            <th className="px-4 py-2 w-10">#</th>
            <th className="px-4 py-2">Filename</th>
            <th className="px-4 py-2">Destination</th>
            <th className="px-4 py-2 w-20">Size</th>
            <th className="px-4 py-2 w-16">Type</th>
            <th className="px-4 py-2 w-28">Output</th>
            <th className="px-4 py-2 w-36">Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-white/30 text-sm">
                  No files in queue. Drop audio or video files above to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => (
                <JobRow
                  key={job.id}
                  job={job}
                  index={i}
                  isSelected={selectedJobId === job.id}
                  onSelect={() => setSelectedJob(selectedJobId === job.id ? null : job.id)}
                />
              ))
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
