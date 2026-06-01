import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Square, ToggleLeft, ToggleRight } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface Props {
  filepath: string;
  outputFilepath: string | null;
  filename: string;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    wma: 'audio/x-ms-wma',
    aiff: 'audio/aiff',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
  };
  return map[ext] ?? 'audio/mpeg';
}

export default function WaveformPlayer({ filepath, outputFilepath, filename }: Props): JSX.Element {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const theme = useSettingsStore((s) => s.theme);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeFile = showOutput && outputFilepath ? outputFilepath : filepath;

  // Theme-derived WaveSurfer colors
  const waveColor = theme === 'dark' ? '#6d28d9' : '#7c3aed';
  const progressColor = theme === 'dark' ? '#a78bfa' : '#4c1d95';
  const cursorColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  // (Re-)create WaveSurfer and load via Blob URL whenever the source file changes
  useEffect(() => {
    if (!waveformRef.current) return;

    // Tear down previous instance and revoke any stale Blob URL
    wsRef.current?.destroy();
    wsRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(null);
    setIsLoading(true);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor,
      progressColor,
      cursorColor,
      cursorWidth: 2,
      barWidth: 3,
      barGap: 1.5,
      barRadius: 3,
      height: 72,
      normalize: true,
      interact: true,
    });

    ws.on('ready', () => {
      setIsReady(true);
      setIsLoading(false);
      setDuration(ws.getDuration());
    });
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('seeking', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));
    ws.on('error', (err) => {
      setLoadError(String(err));
      setIsLoading(false);
    });

    wsRef.current = ws;

    // Use IPC to read raw bytes, create a Blob URL, and hand it to WaveSurfer.
    // Direct asset:// URLs fail because WaveSurfer's internal fetch() hits CORS
    // restrictions on Tauri's custom protocol.
    let cancelled = false;
    (async () => {
      try {
        const arrayBuffer = await invoke<ArrayBuffer>('read_audio_file', { path: activeFile });
        if (cancelled) return;
        const blob = new Blob([arrayBuffer], { type: getMimeType(activeFile) });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        ws.load(blobUrl);
      } catch (err) {
        if (!cancelled) {
          setLoadError(String(err));
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      ws.destroy();
      wsRef.current = null;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile]);

  // Update colors without reloading when theme changes
  useEffect(() => {
    wsRef.current?.setOptions({ waveColor, progressColor, cursorColor });
  }, [waveColor, progressColor, cursorColor]);

  // Space = play/pause, ← = −5 s, → = +5 s
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (!isReady || !wsRef.current) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') {
        e.preventDefault();
        wsRef.current.playPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        wsRef.current.skip(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        wsRef.current.skip(5);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isReady]);

  function togglePlay(): void { wsRef.current?.playPause(); }
  function stop(): void { wsRef.current?.stop(); setCurrentTime(0); }

  return (
    <div className="flex flex-col gap-3">
      {/* Header: filename + A/B toggle */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-wider truncate max-w-[200px]">
          {showOutput && outputFilepath ? `${filename} (enhanced)` : filename}
        </span>
        {outputFilepath && (
          <button
            onClick={() => setShowOutput((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-white/50 hover:text-violet-600 dark:hover:text-violet-400 transition-colors shrink-0"
            title="Toggle A/B: original vs enhanced"
          >
            {showOutput
              ? <ToggleRight size={14} className="text-violet-500" />
              : <ToggleLeft size={14} />}
            {showOutput ? 'Enhanced' : 'Original'}
          </button>
        )}
      </div>

      {/* Waveform canvas */}
      <div
        ref={waveformRef}
        className="rounded-lg overflow-hidden bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] min-h-[72px]"
      />
      {isLoading && (
        <p className="text-[10px] text-slate-400 dark:text-white/30 text-center -mt-2">
          Loading waveform…
        </p>
      )}
      {loadError && (
        <p className="text-[10px] text-red-400 text-center -mt-2 truncate" title={loadError}>
          Failed to load audio
        </p>
      )}

      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="p-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors text-white"
          title="Play / Pause  [Space]"
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          onClick={stop}
          disabled={!isReady}
          className="p-1.5 rounded-md bg-slate-200 dark:bg-white/[0.10] hover:bg-slate-300 dark:hover:bg-white/20 disabled:opacity-40 transition-colors text-slate-700 dark:text-white"
          title="Stop"
        >
          <Square size={12} />
        </button>
        <span className="text-[10px] text-slate-500 dark:text-white/40 tabular-nums ml-1">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-white/25 ml-auto">
          ← → skip 5s · Space play/pause
        </span>
      </div>
    </div>
  );
}
