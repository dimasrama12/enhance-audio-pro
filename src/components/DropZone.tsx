import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles } from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';

interface FileDropPayload { paths: string[]; }

export default function DropZone(): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const { addJobs } = useQueueStore();

  const handleFiles = useCallback(async (paths: string[]): Promise<void> => {
    const valid = paths.filter((p) => validateFile(getFilename(p)).valid);
    const skipped = paths.length - valid.length;

    if (valid.length === 0) {
      setError('No supported audio or video files found.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const res = await invokeAddFiles(valid);
    if (res.success && res.data) {
      addJobs(res.data);
      if (skipped > 0) {
        setError(`${skipped} unsupported file(s) skipped.`);
        setTimeout(() => setError(null), 3000);
      }
    } else {
      setError(res.error ?? 'Failed to add files.');
      setTimeout(() => setError(null), 3000);
    }
    if (res.error) {
      setLimitWarning(res.error);
      setTimeout(() => setLimitWarning(null), 5000);
    }
  }, [addJobs]);

  useEffect(() => {
    const cleanup: (() => void)[] = [];
    Promise.all([
      listen<FileDropPayload>('tauri://file-drop', async (e) => {
        setIsDragging(false);
        await handleFiles(e.payload.paths);
      }),
      listen('tauri://file-drop-hover', () => setIsDragging(true)),
      listen('tauri://file-drop-cancelled', () => setIsDragging(false)),
    ]).then((fns) => cleanup.push(...fns));
    return () => cleanup.forEach((fn) => fn());
  }, [handleFiles]);

  return (
    <div className={clsx(
      'flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed transition-colors shrink-0',
      isDragging ? 'border-violet-400 bg-violet-500/10' : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
    )}>
      <motion.div
        animate={{ scale: isDragging ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="flex flex-col items-center gap-2 text-white/50"
      >
        <Upload size={24} />
        <span className="text-sm">Drop audio or video files here</span>
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-red-400 mt-2">{error}</motion.p>
        )}
      </AnimatePresence>
      {limitWarning && (
        <p className="mt-2 px-3 py-2 bg-orange-500/20 border border-orange-500/40 rounded-lg text-orange-300 text-xs text-center">
          {limitWarning}
        </p>
      )}
    </div>
  );
}
