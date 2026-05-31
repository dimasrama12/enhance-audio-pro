import { useEffect, useCallback, useRef } from 'react';
import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles } from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';

export default function DropZone(): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const { addJobs } = useQueueStore();
  const dragCounterRef = useRef(0);

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
    if (res.success && res.error) {
      setLimitWarning(res.error);
      setTimeout(() => setLimitWarning(null), 5000);
    }
  }, [addJobs]);

  // Keep a ref so the Tauri event handler always calls the latest handleFiles
  // without needing to re-register the listener on every render.
  const handleFilesRef = useRef(handleFiles);
  handleFilesRef.current = handleFiles;

  // Tauri v2 native file-drop events — registered once; cancelled flag guards
  // against the async cleanup race that causes double-registration in React
  // Strict Mode dev double-invoke.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    getCurrentWindow().onDragDropEvent((event) => {
      const type = event.payload.type;
      if (type === 'over') {
        setIsDragging(true);
      } else if (type === 'drop') {
        setIsDragging(false);
        const paths = (event.payload as { type: 'drop'; paths: string[]; position: unknown }).paths;
        if (paths?.length) handleFilesRef.current(paths);
      } else {
        setIsDragging(false);
      }
    }).then((fn) => {
      if (cancelled) fn(); // effect already cleaned up — unlisten immediately
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []); // stable — only register once per mount

  // HTML5 visual drag feedback (for consistent hover styling regardless of Tauri version)
  const onDragEnter = (e: React.DragEvent): void => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent): void => { e.preventDefault(); };
  const onDragLeave = (): void => {
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); }
  };
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    // HTML5 drop can't give full paths in sandboxed contexts; Tauri's onDragDropEvent handles actual file ingestion.
  };

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed transition-colors shrink-0',
        isDragging ? 'border-violet-400 bg-violet-500/10' : 'border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/5 hover:border-zinc-400 dark:hover:border-white/40 hover:bg-zinc-100 dark:hover:bg-white/10'
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <motion.div
        animate={{ scale: isDragging ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="flex flex-col items-center gap-2 text-zinc-400 dark:text-white/50"
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
