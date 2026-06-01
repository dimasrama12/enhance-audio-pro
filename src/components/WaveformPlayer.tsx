import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Square, ToggleLeft, ToggleRight } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
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

export default function WaveformPlayer({ filepath, outputFilepath, filename }: Props): JSX.Element {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const theme = useSettingsStore((s) => s.theme);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const activeFile = showOutput && outputFilepath ? outputFilepath : filepath;

  // Theme-derived WaveSurfer colors
  const waveColor = theme === 'dark' ? '#6d28d9' : '#7c3aed';
  const progressColor = theme === 'dark' ? '#a78bfa' : '#4c1d95';
  const cursorColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';

  // (Re-)create WaveSurfer when the source file changes
  useEffect(() => {
    if (!waveformRef.current) return;

    wsRef.current?.destroy();
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor,
      progressColor,
      cursorColor,
      barWidth: 3,
      barGap: 1.5,
      barRadius: 3,
      height: 72,
      normalize: true,
      interact: true,
    });

    ws.load(convertFileSrc(activeFile));
    ws.on('ready', () => { setIsReady(true); setDuration(ws.getDuration()); });
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile]);

  // Update colors without reloading when theme changes
  useEffect(() => {
    wsRef.current?.setOptions({ waveColor, progressColor, cursorColor });
  }, [waveColor, progressColor, cursorColor]);

  // Keyboard shortcuts: Space=play/pause, ←/→=±5s
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
        className="rounded-lg overflow-hidden bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08]"
      />

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
