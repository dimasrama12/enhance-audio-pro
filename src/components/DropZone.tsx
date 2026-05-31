import { useEffect, useCallback, useRef } from 'react';
import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles } from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';
import { useUIStore } from '@/stores/useUIStore';

export default function DropZone(): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const { addJobs } = useQueueStore();
  const { activeTab } = useUIStore();
  const dragCounterRef = useRef(0);
  const { t } = useTranslation();

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

  const handleFilesRef = useRef(handleFiles);
  handleFilesRef.current = handleFiles;

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
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

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
  };

  const handleClick = async (): Promise<void> => {
    const extensions = activeTab === 'audio'
      ? ['mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'm4a', 'wma', 'aiff', 'mp2']
      : ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv'];
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: activeTab === 'audio' ? 'Audio Files' : 'Video Files', extensions }],
      title: 'Add Files to Queue',
    });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (paths.length) await handleFiles(paths);
  };

  const dropText = activeTab === 'audio' ? t('dropzone.audio') : t('dropzone.video');

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed transition-colors shrink-0 cursor-pointer',
        isDragging
          ? 'border-violet-400 bg-violet-500/10'
          : 'border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/5 hover:border-zinc-400 dark:hover:border-white/40 hover:bg-zinc-100 dark:hover:bg-white/10'
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
    >
      <motion.div
        animate={{ scale: isDragging ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="flex flex-col items-center gap-2 text-zinc-400 dark:text-white/50"
      >
        <Upload size={24} />
        <div className="text-center">
          <span className="text-sm block">{dropText}</span>
          <span className="text-xs text-zinc-400 dark:text-white/30">{t('dropzone.browse')}</span>
        </div>
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-red-400 mt-2">{error}</motion.p>
        )}
      </AnimatePresence>
      {limitWarning && (
        <p className="mt-2 px-3 py-2 bg-orange-500/20 border border-orange-500/40 rounded-lg text-orange-400 dark:text-orange-300 text-xs text-center">
          {limitWarning}
        </p>
      )}
    </div>
  );
}
