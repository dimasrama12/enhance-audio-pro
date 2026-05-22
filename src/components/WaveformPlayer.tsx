import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Square, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  filepath: string;
  outputFilepath: string | null;
  filename: string;
}

export default function WaveformPlayer({ filepath, outputFilepath, filename }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const activeFile = showOutput && outputFilepath ? outputFilepath : filepath;

  useEffect(() => {
    if (!containerRef.current) return;

    wsRef.current?.destroy();
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#7c3aed',
      progressColor: '#a78bfa',
      cursorColor: '#ffffff40',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 56,
      normalize: true,
      interact: true,
    });

    ws.load(`tauri://localhost/${activeFile.replace(/\\/g, '/')}`);

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [activeFile]);

  function togglePlay(): void {
    wsRef.current?.playPause();
  }

  function stop(): void {
    wsRef.current?.stop();
    setCurrentTime(0);
  }

  function fmt(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40 uppercase tracking-wider truncate max-w-[200px]">
          {showOutput && outputFilepath ? `${filename} (enhanced)` : filename}
        </span>
        {outputFilepath && (
          <button
            onClick={() => setShowOutput((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-white/50 hover:text-violet-400 transition-colors"
            title="Toggle A/B original vs enhanced"
          >
            {showOutput ? <ToggleRight size={14} className="text-violet-400" /> : <ToggleLeft size={14} />}
            {showOutput ? 'Enhanced' : 'Original'}
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden bg-white/5 border border-white/10"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="p-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors text-white"
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          onClick={stop}
          disabled={!isReady}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors text-white"
        >
          <Square size={12} />
        </button>
        <span className="text-[10px] text-white/40 tabular-nums">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
