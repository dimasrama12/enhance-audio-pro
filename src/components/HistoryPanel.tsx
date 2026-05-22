import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle, AlertCircle, FileAudio, RefreshCw } from 'lucide-react';
import { invokeGetRecentHistory } from '@/lib/ipc';
import type { QueueJob } from '@/types/queue';

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function HistoryPanel({ open, onClose }: Props): JSX.Element {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const res = await invokeGetRecentHistory();
      if (res.success && res.data) setJobs(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-16 top-0 bottom-0 w-72 bg-neutral-900 border-r border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock size={14} className="text-violet-400" />
                Recent Files
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void load()}
                  disabled={loading}
                  className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-40 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2">
              {loading && jobs.length === 0 && (
                <div className="flex items-center justify-center py-10 text-white/30 text-xs">
                  Loading…
                </div>
              )}
              {!loading && jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-white/30">
                  <FileAudio size={28} />
                  <span className="text-xs">No processed files yet</span>
                </div>
              )}
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="group flex items-start gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                >
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {job.status === 'done' ? (
                      <CheckCircle size={14} className="text-emerald-400" />
                    ) : (
                      <AlertCircle size={14} className="text-red-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/90 truncate" title={job.filename}>
                      {job.filename}
                    </p>
                    {job.output_filepath && (
                      <p className="text-[10px] text-white/40 truncate mt-0.5" title={job.output_filepath}>
                        → {job.output_filepath.split(/[\\/]/).pop()}
                      </p>
                    )}
                    {job.error_message && (
                      <p className="text-[10px] text-red-400/80 truncate mt-0.5" title={job.error_message}>
                        {job.error_message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-white/30">{fmtSize(job.size_bytes)}</span>
                      <span className="text-[9px] text-white/20">·</span>
                      <span className="text-[9px] text-white/30 uppercase">{job.output_format}</span>
                      <span className="text-[9px] text-white/20">·</span>
                      <span className="text-[9px] text-white/30">{fmtDate(job.updated_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
