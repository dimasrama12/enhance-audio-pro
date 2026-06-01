import { useEffect, useCallback, useRef } from 'react';
import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Music, Video, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles, invokeListFolderFiles } from '@/lib/ipc';
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

  const resolveDroppedPaths = useCallback(async (paths: string[]): Promise<string[]> => {
    const resolved: string[] = [];
    for (const p of paths) {
      const folderRes = await invokeListFolderFiles(p);
      if (folderRes.success && folderRes.data && folderRes.data.length > 0) {
        resolved.push(...folderRes.data);
      } else {
        resolved.push(p);
      }
    }
    return resolved;
  }, []);

  const handleFilesRef = useRef(handleFiles);
  handleFilesRef.current = handleFiles;
  const resolveRef = useRef(resolveDroppedPaths);
  resolveRef.current = resolveDroppedPaths;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    getCurrentWindow().onDragDropEvent(async (event) => {
      const type = event.payload.type;
      if (type === 'over') {
        setIsDragging(true);
      } else if (type === 'drop') {
        setIsDragging(false);
        const paths = (event.payload as { type: 'drop'; paths: string[]; position: unknown }).paths;
        if (paths?.length) {
          const resolved = await resolveRef.current(paths);
          if (resolved.length) handleFilesRef.current(resolved);
        }
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

  const isAudio = activeTab === 'audio';
  const dropText = isAudio ? t('dropzone.audio') : t('dropzone.video');
  const TabIcon = isAudio ? Music : Video;

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center justify-center h-[100px] rounded-xl border-2 border-dashed transition-all duration-200 shrink-0 cursor-pointer overflow-hidden group',
        isDragging
          ? 'border-violet-400 bg-violet-500/10 dark:bg-violet-500/[0.08]'
          : [
              'border-slate-300 dark:border-white/[0.12]',
              'bg-white dark:bg-[#0F172A]',
              'hover:border-violet-300 dark:hover:border-violet-500/40',
              'hover:bg-violet-50/40 dark:hover:bg-violet-900/[0.06]',
            ],
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleClick}
    >
      {/* Subtle background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.02] to-transparent pointer-events-none" />

      <motion.div
        animate={{ scale: isDragging ? 1.08 : 1, y: isDragging ? -2 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="flex items-center gap-4 text-slate-400 dark:text-white/40 z-10"
      >
        {/* Icon cluster */}
        <div className="relative">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200',
            isDragging
              ? 'bg-violet-500/20 text-violet-400'
              : 'bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-white/30 group-hover:bg-violet-100 dark:group-hover:bg-violet-500/10 group-hover:text-violet-500 dark:group-hover:text-violet-400',
          )}>
            <Upload size={18} />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-200 dark:bg-[#1A2237] border border-slate-300 dark:border-white/[0.08] flex items-center justify-center">
            <TabIcon size={9} className="text-slate-500 dark:text-white/50" />
          </div>
        </div>

        {/* Text */}
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-tight">{dropText}</p>
          <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">
            {t('dropzone.browse')}
            {' · '}
            <span className="text-slate-400 dark:text-white/20">
              {isAudio ? 'MP3, WAV, FLAC, AAC +7' : 'MP4, MKV, MOV, AVI +2'}
            </span>
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-2 text-xs text-red-400 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {limitWarning && (
        <p className="absolute bottom-2 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 text-xs text-center">
          {limitWarning}
        </p>
      )}
    </div>
  );
}
