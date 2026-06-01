import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import WaveformPlayer from '@/components/WaveformPlayer';

export default function ManipulationPanel(): JSX.Element {
  const jobs = useQueueStore((s) => s.jobs);
  const selectedJobId = useQueueStore((s) => s.primarySelectedId());
  const setSelectedJob = useQueueStore((s) => s.setSelectedJob);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <AnimatePresence>
      {selectedJob && (
        <motion.div
          key="manipulation-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="overflow-hidden shrink-0"
        >
          <div className="rounded-xl bg-white dark:bg-[#0D1525] border border-slate-200 dark:border-white/[0.07] shadow-sm dark:shadow-none p-3 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-white/40 truncate max-w-[80%]">
                <span className="text-violet-600 dark:text-violet-400 font-medium">{selectedJob.filename}</span>
                <span className="text-slate-400 dark:text-white/30"> — waveform player</span>
              </span>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-md text-slate-400 dark:text-white/30 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors shrink-0"
                title="Close"
              >
                <X size={12} />
              </button>
            </div>

            <WaveformPlayer
              filepath={selectedJob.filepath}
              outputFilepath={selectedJob.output_filepath ?? null}
              filename={selectedJob.filename}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
