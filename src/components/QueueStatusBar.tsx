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
    <div className="flex items-center gap-4 px-1 text-[11px] select-none">
      <span className="text-slate-500 dark:text-slate-400 font-medium">
        {total} file{total !== 1 ? 's' : ''}
      </span>
      {pending > 0 && (
        <span className="text-slate-400 dark:text-slate-500">{pending} pending</span>
      )}
      {processing > 0 && (
        <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 status-processing-dot" />
          {processing} processing
        </span>
      )}
      {done > 0 && (
        <span className="text-emerald-600 dark:text-emerald-400">{done} done</span>
      )}
      {error > 0 && (
        <span className="text-red-500 dark:text-red-400">{error} error{error !== 1 ? 's' : ''}</span>
      )}
      {(processing > 0 || jobs.some(j => j.status === 'queued')) && (
        <>
          <span className="text-slate-300 dark:text-white/10">|</span>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('queue:cancel-all'))}
            className="text-red-500 hover:text-red-400 font-semibold focus:outline-none transition-colors transition-all active:scale-95 cursor-pointer"
          >
            Cancel All
          </button>
        </>
      )}
    </div>
  );
}
