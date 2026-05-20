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
      <td className={clsx('px-4 py-2 text-xs font-medium capitalize w-28', STATUS_COLORS[job.status])}>
        {job.status}
      </td>
    </motion.tr>
  );
}

export default function QueueGrid(): JSX.Element {
  const jobs = useQueueStore((s) => s.filteredJobs());

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
            <th className="px-4 py-2 w-28">Status</th>
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
