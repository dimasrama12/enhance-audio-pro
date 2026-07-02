import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { useUIStore } from '@/stores/useUIStore';
import WaveformPlayer from '@/components/WaveformPlayer';

export default function ManipulationPanel(): JSX.Element {
  const playerOpen = useUIStore((s) => s.playerOpen);
  const activePlayerJobId = useUIStore((s) => s.activePlayerJobId);
  const setPlayerOpen = useUIStore((s) => s.setPlayerOpen);

  const activeEntry = useQueueStore((s) => {
    if (!activePlayerJobId) return null;
    for (const tab of ['enhance', 'convert'] as const) {
      const job = s.tabQueues[tab].find((j) => j.id === activePlayerJobId);
      if (job) return { job, tab };
    }
    return null;
  });
  const activeJob = activeEntry?.job ?? null;
  // The Original/Enhanced A/B toggle is only relevant in the Enhance tab.
  const showAbToggle = activeEntry?.tab === 'enhance';
  const showPlayer = playerOpen && activeJob;

  return (
    <AnimatePresence>
      {showPlayer && (
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
                <span className="text-violet-600 dark:text-violet-400 font-medium">{activeJob.filename}</span>
                <span className="text-slate-400 dark:text-white/30"> — waveform player</span>
              </span>
              <button
                onClick={() => setPlayerOpen(false)}
                className="p-1 rounded-md text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                title="Close"
              >
                <X size={12} />
              </button>
            </div>

            <WaveformPlayer
              filepath={activeJob.filepath}
              outputFilepath={activeJob.output_filepath ?? null}
              filename={activeJob.filename}
              showAbToggle={showAbToggle}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
