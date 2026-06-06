import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useQueueStore } from '@/stores/useQueueStore';
import { useToastStore } from '@/stores/useToastStore';
import { invokeCopyEnhancedFile } from '@/lib/ipc';
import type { QueueJob } from '@/types/queue';

async function downloadFilesToFolder(jobs: QueueJob[], addToast: (msg: string, type: string) => void): Promise<void> {
  const folder = await openDialog({ directory: true, multiple: false, title: 'Select Download Folder' });
  if (typeof folder !== 'string' || !folder) return;

  let count = 0;
  for (const job of jobs) {
    if (!job.output_filepath) continue;
    const filename = job.output_filepath.replace(/\\/g, '/').split('/').pop() ?? job.filename;
    const sep = folder.includes('\\') ? '\\' : '/';
    const destPath = `${folder}${sep}${filename}`;
    const res = await invokeCopyEnhancedFile(job.output_filepath, destPath);
    if (res.success) count++;
  }
  addToast(`Downloaded ${count} file${count !== 1 ? 's' : ''} to ${folder}`, 'success');
}

export default function QueueStatusBar(): JSX.Element {
  const jobs = useQueueStore((s) => s.jobs);
  const selectedJobIds = useQueueStore((s) => s.selectedJobIds);
  const { addToast } = useToastStore();

  const total = jobs.length;
  const pending = jobs.filter((j) => j.status === 'pending').length;
  const processing = jobs.filter((j) => j.status === 'processing').length;
  const done = jobs.filter((j) => j.status === 'done').length;
  const error = jobs.filter((j) => j.status === 'error').length;

  // Done jobs among the current selection
  const selectedDoneJobs = selectedJobIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is QueueJob => !!j && j.status === 'done' && !!j.output_filepath);

  // All done jobs in the queue (for "Download all" condition)
  const allDoneJobs = jobs.filter((j) => j.status === 'done' && !!j.output_filepath);

  // Show "Download selected" when 2+ selected rows are done
  const showDownloadSelected = selectedDoneJobs.length >= 2;
  // Show "Download all" when no selection-based download, queue is non-empty,
  // no active processing, and at least one done file exists
  const isAnyActive = jobs.some((j) => j.status === 'processing' || j.status === 'queued');
  const showDownloadAll = !showDownloadSelected && !isAnyActive && allDoneJobs.length >= 1 && pending === 0 && error === 0 && total > 0 && done === total;

  if (total === 0) return <></>;

  return (
    <div className="flex items-center gap-4 px-1 text-[11px] select-none flex-wrap">
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
            className="text-red-500 hover:text-red-400 font-semibold focus:outline-none transition-colors active:scale-95 cursor-pointer"
          >
            Cancel All
          </button>
        </>
      )}
      {showDownloadSelected && (
        <>
          <span className="text-slate-300 dark:text-white/10">|</span>
          <button
            onClick={() => void downloadFilesToFolder(selectedDoneJobs, addToast as (msg: string, type: string) => void)}
            className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold focus:outline-none transition-colors active:scale-95 cursor-pointer"
          >
            Download selected ({selectedDoneJobs.length})
          </button>
        </>
      )}
      {showDownloadAll && (
        <>
          <span className="text-slate-300 dark:text-white/10">|</span>
          <button
            onClick={() => void downloadFilesToFolder(allDoneJobs, addToast as (msg: string, type: string) => void)}
            className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold focus:outline-none transition-colors active:scale-95 cursor-pointer"
          >
            Download all ({allDoneJobs.length})
          </button>
        </>
      )}
    </div>
  );
}
