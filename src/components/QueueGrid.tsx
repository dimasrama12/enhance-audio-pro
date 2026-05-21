import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useQueueStore } from '@/stores/useQueueStore';
import type { QueueJob, JobStatus } from '@/types/queue';

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

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

function JobRow({ job, index }: { job: QueueJob; index: number }): JSX.Element {
  return (
    <motion.tr
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="px-4 py-2 text-white/30 text-xs w-10">{index + 1}</td>
      <td className="px-4 py-2 text-sm text-white truncate max-w-[200px]">{job.filename}</td>
      <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[160px]">{job.destination || '—'}</td>
      <td className="px-4 py-2 text-xs text-white/50 w-24">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-white/40 w-20">{job.media_type}</td>
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
            <th className="px-4 py-2 w-24">Size</th>
            <th className="px-4 py-2 w-20">Type</th>
            <th className="px-4 py-2 w-36">Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-white/30 text-sm">
                  No files in queue. Drop audio or video files above to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => <JobRow key={job.id} job={job} index={i} />)
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
