import { useQueueStore } from '@/stores/useQueueStore';

export default function QueueStatusBar(): JSX.Element {
  const jobs = useQueueStore((s) => s.jobs);

  const total = jobs.length;
  const pending = jobs.filter((j) => j.status === 'pending').length;
  const processing = jobs.filter((j) => j.status === 'processing').length;
  const done = jobs.filter((j) => j.status === 'done').length;
  const error = jobs.filter((j) => j.status === 'error').length;

  if (total === 0) return <></>;

  return (
    <div className="flex items-center gap-4 px-1 text-xs text-zinc-400 dark:text-white/40 select-none">
      <span className="text-zinc-600 dark:text-white/60 font-medium">{total} file{total !== 1 ? 's' : ''}</span>
      {pending > 0 && <span className="text-yellow-400/70">{pending} pending</span>}
      {processing > 0 && <span className="text-blue-400/70">{processing} processing</span>}
      {done > 0 && <span className="text-green-400/70">{done} done</span>}
      {error > 0 && <span className="text-red-400/70">{error} error{error !== 1 ? 's' : ''}</span>}
    </div>
  );
}
