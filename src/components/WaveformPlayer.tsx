import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import { Play, Pause, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface Props {
  filepath: string;
  outputFilepath: string | null;
  filename: string;
}

function dbToLinear(db: number): number {
  if (db <= -40) return 0;
  return Math.min(4.0, Math.pow(10, db / 20));
}

function formatTimeHHMMSSFF(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  const frames = Math.floor((sec % 1) * 30);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac',
    ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', wma: 'audio/x-ms-wma',
    aiff: 'audio/aiff', mp4: 'video/mp4', webm: 'video/webm',
    mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  };
  return map[ext] ?? 'audio/mpeg';
}

interface AudioCacheItem {
  blobUrl: string;
  reversedBuffer: AudioBuffer | null;
  peaks: Float32Array[] | null;
  duration: number;
}
const audioCache = new Map<string, AudioCacheItem>();

const FRAME_SIZE = 1 / 30;

export default function WaveformPlayer({ filepath, outputFilepath, filename }: Props): JSX.Element {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore((s) => s.theme);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(0);
  const [minZoom, setMinZoom] = useState(0);
  const minZoomRef = useRef(0);
  minZoomRef.current = minZoom;

  // Dynamic maxZoom: containerWidth * FPS so 1 frame fills the full width (Premiere Pro style)
  const [maxZoom, setMaxZoom] = useState(2000);
  const maxZoomRef = useRef(2000);

  const [isFocused, setIsFocused] = useState(false);
  const [volumeDb, setVolumeDb] = useState(0);
  // jlSpeed: -4 | -2 | -1 | 0 | 1 | 2 | 4  (sign = direction, magnitude = multiplier)
  const [jlSpeed, setJlSpeed] = useState(0);

  const jlSpeedRef = useRef(0);
  jlSpeedRef.current = jlSpeed;

  const volumeDbRef = useRef(0);
  volumeDbRef.current = volumeDb;

  // Forward playback RAF for smooth time display
  const playbackRafRef = useRef<number | null>(null);

  // Refs for backward audio via AudioContext (reversed AudioBuffer)
  const reversedBufferRef = useRef<AudioBuffer | null>(null);
  const reverseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const reverseStartCtxTimeRef = useRef<number>(0);
  const reverseStartPosRef = useRef<number>(0);
  const reverseSpeedMagRef = useRef<number>(1);
  const reverseRafRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isProgrammaticSeekRef = useRef(false);
  const loadGenRef = useRef(0);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []);

  // Auto-focus on mount so keyboard shortcuts work immediately after opening
  useEffect(() => {
    const t = setTimeout(() => { containerRef.current?.focus(); }, 200);
    return () => clearTimeout(t);
  }, []);

  const activeFile = showOutput && outputFilepath ? outputFilepath : filepath;

  const waveColor = theme === 'dark' ? '#6d28d9' : '#7c3aed';
  const progressColor = theme === 'dark' ? '#a78bfa' : '#4c1d95';
  const cursorColor = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  const stopPlaybackRaf = (): void => {
    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
  };

  // Stop reverse audio source and cancel its RAF loop
  const stopReverseAudio = (): void => {
    if (reverseRafRef.current !== null) {
      cancelAnimationFrame(reverseRafRef.current);
      reverseRafRef.current = null;
    }
    if (reverseSourceRef.current) {
      try { reverseSourceRef.current.stop(0); } catch { /* already stopped */ }
      try { reverseSourceRef.current.disconnect(); } catch { /* already disconnected */ }
      reverseSourceRef.current = null;
    }
  };

  const clearReverseTimer = (): void => {
    stopReverseAudio();
  };

  // Central speed-state machine
  const applySpeed = (speed: number): void => {
    jlSpeedRef.current = speed;
    setJlSpeed(speed);
    stopReverseAudio();
    stopPlaybackRaf();

    if (speed === 0) {
      wsRef.current?.pause();
      wsRef.current?.setPlaybackRate(1.0);
    } else if (speed > 0) {
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      wsRef.current?.setPlaybackRate(speed);
      wsRef.current?.play();
    } else {
      // Backward playback with actual audio via reversed AudioBuffer
      wsRef.current?.pause();
      wsRef.current?.setPlaybackRate(1.0);
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();

      const capturedSpeed = speed; // capture for async closure

      const startBackward = async (): Promise<void> => {
        const audioCtx = audioContextRef.current;
        const ws = wsRef.current;
        if (!audioCtx || !ws) return;

        // If the speed changed since we were scheduled, abort
        if (jlSpeedRef.current !== capturedSpeed) return;

        let reversed = reversedBufferRef.current;

        // Decode and build reversed buffer on first backward use for this file
        if (!reversed && blobUrlRef.current) {
          try {
            const resp = await fetch(blobUrlRef.current);
            const ab = await resp.arrayBuffer();
            const buf = await audioCtx.decodeAudioData(ab);

            const rev = audioCtx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
            for (let ch = 0; ch < buf.numberOfChannels; ch++) {
              const srcData = buf.getChannelData(ch);
              const dstData = rev.getChannelData(ch);
              for (let i = 0; i < srcData.length; i++) {
                dstData[i] = srcData[srcData.length - 1 - i];
              }
            }
            reversedBufferRef.current = rev;
            reversed = rev;
            const item = audioCache.get(activeFile);
            if (item) item.reversedBuffer = rev;
          } catch (e) {
            console.warn('Failed to decode audio for backward playback:', e);
            return;
          }
        }

        if (!reversed) return;
        // Abort if speed changed while we were decoding
        if (jlSpeedRef.current !== capturedSpeed) return;
        // Abort if another reverse source is already running
        if (reverseSourceRef.current) return;

        const currentPos = ws.getCurrentTime();
        const dur = ws.getDuration();
        // In the reversed buffer, position (dur - currentPos) corresponds to our current position
        const startOffset = Math.max(0, dur - currentPos);
        const mag = Math.abs(capturedSpeed);

        const source = audioCtx.createBufferSource();
        source.buffer = reversed;
        source.playbackRate.value = mag;

        // Route through gain node for volume control
        const dest = gainNodeRef.current ?? audioCtx.destination;
        source.connect(dest);

        reverseStartCtxTimeRef.current = audioCtx.currentTime;
        reverseStartPosRef.current = currentPos;
        reverseSpeedMagRef.current = mag;

        source.start(0, startOffset);
        reverseSourceRef.current = source;

        // RAF loop: use AudioContext clock for sample-accurate position tracking
        const rafTick = (): void => {
          const wsInner = wsRef.current;
          const ctxInner = audioContextRef.current;
          // Stop if source was replaced or cleared
          if (!wsInner || !ctxInner || reverseSourceRef.current !== source) return;

          const elapsed = (ctxInner.currentTime - reverseStartCtxTimeRef.current) * reverseSpeedMagRef.current;
          const newPos = Math.max(0, reverseStartPosRef.current - elapsed);

          if (newPos <= 0) {
            stopReverseAudio();
            jlSpeedRef.current = 0;
            setJlSpeed(0);
            wsInner.setTime(0);
            setCurrentTime(0);
            return;
          }

          isProgrammaticSeekRef.current = true;
          wsInner.setTime(newPos);
          isProgrammaticSeekRef.current = false;
          setCurrentTime(newPos);

          reverseRafRef.current = requestAnimationFrame(rafTick);
        };
        reverseRafRef.current = requestAnimationFrame(rafTick);
      };

      void startBackward();
    }
  };

  // Speed ladder: −4 ↔ −2 ↔ 1 ↔ 2 ↔ 4
  // L moves UP the ladder (toward +4x), J moves DOWN (toward −4x)
  const handleL = (): void => {
    const cur = jlSpeedRef.current;
    if (cur === -4) {
      applySpeed(-2);
    } else if (cur === -2) {
      // Skip pause — resume at normal 1x
      applySpeed(1);
    } else if (cur === 0 || cur === 1) {
      applySpeed(2);
    } else if (cur === 2) {
      applySpeed(4);
    }
    // at 4 already — no-op
  };

  const handleJ = (): void => {
    const cur = jlSpeedRef.current;
    if (cur === 4) {
      applySpeed(2);
    } else if (cur === 2) {
      applySpeed(1);
    } else if (cur === 1 || cur === 0) {
      // Skip pause — jump directly to backward 2x
      applySpeed(-2);
    } else if (cur === -2) {
      applySpeed(-4);
    }
    // at -4 already — no-op
  };

  const resetSpeed = (): void => applySpeed(0);



  // (Re-)create WaveSurfer whenever active file changes
  useEffect(() => {
    let cancelled = false;
    const gen = ++loadGenRef.current;
    const isStale = (): boolean => cancelled || loadGenRef.current !== gen;

    // Immediate cleanup of any existing instance and state reset
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
    blobUrlRef.current = null;

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(null);
    setIsLoading(true);
    setZoom(0);
    setMinZoom(0);
    clearReverseTimer();
    stopPlaybackRaf();
    jlSpeedRef.current = 0;
    setJlSpeed(0);
    reversedBufferRef.current = null;

    if (!waveformRef.current) return;

    // Outer-scope refs for cleanup (populated inside the setTimeout callback)
    let resizeObserver: ResizeObserver | null = null;
    let container: HTMLDivElement | null = null;
    let handleWheel: ((e: WheelEvent) => void) | null = null;

    // 50 ms debounce: if the user switches files rapidly, only the last
    // switch actually creates a WaveSurfer instance, preventing the
    // rapid create→destroy cycle that causes audio element error races.
    const initTimer = setTimeout(() => {
      if (isStale() || !waveformRef.current) return;

      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor,
        progressColor,
        cursorColor,
        cursorWidth: 2,
        height: 72,
        normalize: true,
        interact: true,
        dragToSeek: true,
        hideScrollbar: true,
        renderFunction: (channels, ctx) => {
          const { width, height } = ctx.canvas;
          const channel = channels[0];
          if (!channel) return;
          const len = channel.length;
          const step = len / width;
          ctx.beginPath();
          ctx.moveTo(0, height);
          const gain = dbToLinear(volumeDbRef.current);
          for (let x = 0; x < width; x++) {
            const start = Math.floor(x * step);
            const end = Math.max(start + 1, Math.floor((x + 1) * step));
            let maxVal = 0;
            for (let i = start; i < end; i++) {
              const val = Math.abs(channel[i] || 0);
              if (val > maxVal) maxVal = val;
            }
            const amp = Math.min(0.98, maxVal * gain);
            ctx.lineTo(x, height - amp * height);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
        },
        plugins: [
          TimelinePlugin.create({
            height: 18,
            insertPosition: 'beforebegin',
            style: {
              color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
              fontSize: '9px',
              fontFamily: 'monospace',
            },
            formatTimeCallback: (sec) => {
              const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
              const f = Math.floor((sec % 1) * 30);
              return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`;
            },
          }),
        ],
      });

      ws.on('ready', () => {
        if (isStale()) return;
        setIsReady(true);
        setIsLoading(false);
        const dur = ws.getDuration();
        setDuration(dur);
        const containerWidth = waveformRef.current?.clientWidth ?? 800;
        const fitPxPerSec = dur > 0 ? containerWidth / dur : 0;
        minZoomRef.current = fitPxPerSec;
        setMinZoom(fitPxPerSec);
        setZoom(fitPxPerSec);
        ws.zoom(fitPxPerSec);

        // Compute max zoom: capped at 200, but at least fitPxPerSec for short files
        const calculatedMaxZoom = Math.max(200, fitPxPerSec);
        maxZoomRef.current = calculatedMaxZoom;
        setMaxZoom(calculatedMaxZoom);

        let audioCtx = audioContextRef.current;
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          audioContextRef.current = audioCtx;
        }
        gainNodeRef.current = null;
        const mediaEl = ws.getMediaElement();
        if (mediaEl) {
          try {
            const source = audioCtx.createMediaElementSource(mediaEl);
            const gainNode = audioCtx.createGain();
            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            gainNode.gain.value = dbToLinear(volumeDbRef.current);
            gainNodeRef.current = gainNode;
          } catch (err) {
            console.error('Error creating Web Audio source:', err);
          }
        }
        ws.setVolume(1.0);

        // Cache the loaded audio details when it is fully loaded
        if (!audioCache.has(activeFile) && blobUrlRef.current) {
          let peaks: Float32Array[] | null = null;
          try {
            const decoded = ws.getDecodedData();
            if (decoded) {
              const channels: Float32Array[] = [];
              for (let i = 0; i < decoded.numberOfChannels; i++) {
                channels.push(decoded.getChannelData(i));
              }
              peaks = channels;
            }
          } catch (e) {
            console.warn('Failed to get decoded peaks for caching:', e);
          }
          audioCache.set(activeFile, {
            blobUrl: blobUrlRef.current,
            reversedBuffer: reversedBufferRef.current,
            peaks,
            duration: dur,
          });
        }

        // Pre-decode and reverse the buffer in the background for instant backward playback
        const prepareReverseBuffer = async () => {
          const currentFile = activeFile;
          const cached = audioCache.get(currentFile);
          if (cached && cached.reversedBuffer) {
            if (isStale()) return;
            reversedBufferRef.current = cached.reversedBuffer;
            return;
          }

          if (blobUrlRef.current && audioCtx) {
            try {
              const resp = await fetch(blobUrlRef.current);
              if (isStale()) return;
              const ab = await resp.arrayBuffer();
              if (isStale()) return;
              const buf = await audioCtx.decodeAudioData(ab);
              if (isStale()) return;
              const rev = audioCtx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
              for (let ch = 0; ch < buf.numberOfChannels; ch++) {
                const srcData = buf.getChannelData(ch);
                const dstData = rev.getChannelData(ch);
                for (let i = 0; i < srcData.length; i++) {
                  dstData[i] = srcData[srcData.length - 1 - i];
                }
              }
              if (isStale()) return;
              reversedBufferRef.current = rev;
              const item = audioCache.get(currentFile);
              if (item) {
                item.reversedBuffer = rev;
              }
            } catch (e) {
              console.warn('Failed to pre-decode reverse buffer:', e);
            }
          }
        };
        void prepareReverseBuffer();
      });

      ws.on('audioprocess', () => { if (!isStale()) setCurrentTime(ws.getCurrentTime()); });
      ws.on('seeking', () => {
        if (isStale()) return;
        setCurrentTime(ws.getCurrentTime());
      });
      ws.on('interaction', () => {
        containerRef.current?.focus();
        if (jlSpeedRef.current < 0) {
          clearReverseTimer();
          jlSpeedRef.current = 0;
          setJlSpeed(0);
        }
      });
      ws.on('play', () => {
        if (isStale()) return;
        setIsPlaying(true);
        // Supplement audioprocess with RAF for smooth time display during forward playback
        const rafTick = (): void => {
          if (wsRef.current) setCurrentTime(wsRef.current.getCurrentTime());
          playbackRafRef.current = requestAnimationFrame(rafTick);
        };
        stopPlaybackRaf();
        playbackRafRef.current = requestAnimationFrame(rafTick);
      });
      ws.on('pause', () => {
        if (isStale()) return;
        setIsPlaying(false);
        stopPlaybackRaf();
        if (jlSpeedRef.current > 0) {
          jlSpeedRef.current = 0;
          setJlSpeed(0);
          ws.setPlaybackRate(1.0);
        }
      });
      ws.on('finish', () => {
        if (isStale()) return;
        setIsPlaying(false);
        stopPlaybackRaf();
      });
      ws.on('error', (err) => {
        if (isStale()) return;
        setLoadError(String(err));
        setIsLoading(false);
      });

      wsRef.current = ws;

      resizeObserver = new ResizeObserver(() => {
        if (wsRef.current && waveformRef.current) {
          const dur = wsRef.current.getDuration();
          const containerWidth = waveformRef.current.clientWidth ?? 0;
          if (dur > 0 && containerWidth > 0) {
            const fitPxPerSec = containerWidth / dur;
            minZoomRef.current = fitPxPerSec;
            setMinZoom(fitPxPerSec);

            // Update maxZoom when container resizes, capped at 200 (or fitPxPerSec)
            const calculatedMaxZoom = Math.max(200, fitPxPerSec);
            maxZoomRef.current = calculatedMaxZoom;
            setMaxZoom(calculatedMaxZoom);

            setZoom((prev) => {
              if (prev <= minZoomRef.current + 0.1) { wsRef.current?.zoom(fitPxPerSec); return fitPxPerSec; }
              return prev;
            });
          }
        }
        try { ws.setOptions({}); } catch (err) { console.error('Resize setOptions error:', err); }
      });
      if (waveformRef.current) resizeObserver.observe(waveformRef.current);

      container = waveformRef.current;
      handleWheel = (e: WheelEvent) => {
        const currentMinZoom = minZoomRef.current;
        const currentMaxZoom = maxZoomRef.current;
        if (e.altKey) {
          e.preventDefault();
          const zoomFactor = e.deltaY > 0 ? -3 : 3;
          const currentZoom = ws.options.minPxPerSec ?? currentMinZoom;
          const newZoom = Math.max(currentMinZoom, Math.min(currentMaxZoom, currentZoom + zoomFactor));
          ws.zoom(newZoom);
          setZoom(newZoom);
        } else {
          e.preventDefault();
          const currentZoom = ws.options.minPxPerSec ?? currentMinZoom;
          if (currentZoom > currentMinZoom + 0.1) {
            const scrollDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            ws.setScroll(ws.getScroll() + scrollDelta);
          }
        }
      };
      if (container) container.addEventListener('wheel', handleWheel, { passive: false });

      (async () => {
        try {
          const cached = audioCache.get(activeFile);
          if (cached) {
            blobUrlRef.current = cached.blobUrl;
            reversedBufferRef.current = cached.reversedBuffer;
            if (!isStale()) {
              ws.load(cached.blobUrl, cached.peaks ?? undefined, cached.duration);
            }
            return;
          }

          const rawData = await invoke<unknown>('read_audio_file', { path: activeFile });
          if (isStale()) return;
          let bufferSource = rawData;
          if (rawData && typeof rawData === 'object' && 'body' in rawData) bufferSource = (rawData as Record<string, unknown>).body;
          let binaryData: ArrayBuffer | Uint8Array;
          if (bufferSource instanceof Uint8Array || bufferSource instanceof ArrayBuffer) {
            binaryData = bufferSource;
          } else if (Array.isArray(bufferSource)) {
            binaryData = new Uint8Array(bufferSource as number[]);
          } else {
            throw new Error('Unsupported binary response format from backend');
          }
          const blob = new Blob([binaryData as BlobPart], { type: getMimeType(activeFile) });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          if (!isStale()) {
            ws.load(blobUrl);
          }
        } catch (err) {
          if (!isStale()) { setLoadError(String(err)); setIsLoading(false); }
        }
      })();
    }, 50); // end initTimer

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearReverseTimer();
      stopPlaybackRaf();
      reversedBufferRef.current = null;
      if (container && handleWheel) container.removeEventListener('wheel', handleWheel);
      if (resizeObserver) resizeObserver.disconnect();
      if (gainNodeRef.current) {
        try { gainNodeRef.current.disconnect(); } catch { /* already disconnected */ }
        gainNodeRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.unAll();
        wsRef.current.destroy();
        wsRef.current = null;
      }
      blobUrlRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile]);

  useEffect(() => {
    if (!wsRef.current) return;
    try { wsRef.current.setOptions({ waveColor, progressColor, cursorColor }); } catch { /* mid-destroy */ }
  }, [waveColor, progressColor, cursorColor]);

  // Keyboard handler — only active when player container is focused or for global keys
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (!isReady || !wsRef.current) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isGlobalKey = e.key === ' ' || e.key === 'Shift';
      if (!isGlobalKey && !isFocused) return;

      if (e.key === ' ') {
        e.preventDefault();
        // In accelerated mode, Space stops; otherwise toggle
        if (jlSpeedRef.current !== 0) {
          applySpeed(0);
        } else {
          if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
          wsRef.current.playPause();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (jlSpeedRef.current < 0) {
          clearReverseTimer();
          jlSpeedRef.current = 0;
          setJlSpeed(0);
        }
        if (e.ctrlKey) {
          wsRef.current.setTime(0);
          setCurrentTime(0);
        } else if (e.shiftKey) {
          wsRef.current.skip(-5);
        } else {
          wsRef.current.skip(-1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (jlSpeedRef.current < 0) {
          clearReverseTimer();
          jlSpeedRef.current = 0;
          setJlSpeed(0);
        }
        if (e.ctrlKey) {
          const dur = wsRef.current.getDuration();
          wsRef.current.setTime(dur);
          setCurrentTime(dur);
        } else if (e.shiftKey) {
          wsRef.current.skip(5);
        } else {
          wsRef.current.skip(1);
        }
      } else if (e.key === 'Shift') {
        e.preventDefault();
        const isLeft = e.code === 'ShiftLeft' || e.location === 1;
        const isRight = e.code === 'ShiftRight' || e.location === 2;
        if (isLeft) {
          const newTime = Math.max(0, wsRef.current.getCurrentTime() - FRAME_SIZE);
          wsRef.current.setTime(newTime);
          setCurrentTime(newTime);
        } else if (isRight) {
          const newTime = Math.min(wsRef.current.getDuration(), wsRef.current.getCurrentTime() + FRAME_SIZE);
          wsRef.current.setTime(newTime);
          setCurrentTime(newTime);
        }
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleJ();
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleL();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.min(10, volumeDbRef.current + 1);
        volumeDbRef.current = next;
        setVolumeDb(next);
        try {
          if (gainNodeRef.current) gainNodeRef.current.gain.value = dbToLinear(next);
          wsRef.current.setOptions({});
        } catch (err) { console.error('Error setting volume:', err); }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.max(-40, volumeDbRef.current - 1);
        volumeDbRef.current = next;
        setVolumeDb(next);
        try {
          if (gainNodeRef.current) gainNodeRef.current.gain.value = dbToLinear(next);
          wsRef.current.setOptions({});
        } catch (err) { console.error('Error setting volume:', err); }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isFocused]);

  function togglePlay(): void {
    if (!wsRef.current) return;
    if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
    if (jlSpeedRef.current !== 0) {
      applySpeed(0);
    } else {
      wsRef.current.playPause();
    }
  }

  function handleZoomChange(level: number): void {
    setZoom(level);
    wsRef.current?.zoom(level);
  }

  const handleReset = (): void => {
    if (!wsRef.current) return;
    wsRef.current.pause();
    setIsPlaying(false);
    wsRef.current.setTime(0);
    setCurrentTime(0);
    resetSpeed();
    volumeDbRef.current = 0;
    setVolumeDb(0);
    if (gainNodeRef.current) gainNodeRef.current.gain.value = dbToLinear(0);
    wsRef.current.setVolume(1.0);
    const initialMin = minZoomRef.current;
    wsRef.current.zoom(initialMin);
    setZoom(initialMin);
    try { wsRef.current.setOptions({}); } catch (err) { console.error('Error redrawing on reset:', err); }
  };

  const handleFocus = (): void => setIsFocused(true);
  const handleBlur = (e: React.FocusEvent): void => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    // Defer so onClick → focus() on non-focusable inner elements (waveform canvas)
    // fires first, preventing a visible border-disappear flicker.
    const container = e.currentTarget;
    setTimeout(() => {
      if (!container.contains(document.activeElement)) setIsFocused(false);
    }, 0);
  };

  // Human-readable speed badge
  const speedLabel = jlSpeed !== 0
    ? (jlSpeed > 0 ? `${jlSpeed}x ▶` : `${Math.abs(jlSpeed)}x ◀`)
    : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={() => containerRef.current?.focus()}
      className={`waveform-player-container flex flex-col gap-3 focus:outline-none p-3 rounded-xl border transition-all duration-200 ${
        isFocused
          ? 'border-violet-500/40 bg-violet-500/[0.02] shadow-sm shadow-violet-500/5'
          : 'border-transparent'
      }`}
    >
      {/* Header: filename + speed indicator + A/B toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-wider truncate max-w-[200px]">
            {showOutput && outputFilepath ? `${filename} (enhanced)` : filename}
          </span>
          {speedLabel && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 shrink-0">
              {speedLabel}
            </span>
          )}
        </div>
        {outputFilepath && (
          <button
            onClick={() => setShowOutput((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-white/50 hover:text-violet-600 dark:hover:text-violet-400 transition-colors shrink-0"
            title="Toggle A/B: original vs enhanced"
          >
            {showOutput ? <ToggleRight size={14} className="text-violet-500" /> : <ToggleLeft size={14} />}
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
        <p className="text-[10px] text-slate-400 dark:text-white/30 text-center -mt-2">Loading waveform…</p>
      )}
      {loadError && (
        <p className="text-[10px] text-red-400 text-center -mt-2 truncate" title={loadError}>Failed to load audio</p>
      )}

      {/* Combined Playback & Zoom Controls Row */}
      <div className="flex items-center gap-3 px-1 select-none w-full">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="p-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors text-white shrink-0"
          title="Play / Pause  [Space]"
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <button
          onClick={handleReset}
          disabled={!isReady}
          className="p-1.5 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors text-white shrink-0"
          title="Reset (pause, seek 0, speed 1x, vol 0 dB, zoom fit)"
        >
          <RotateCcw size={12} />
        </button>

        <span className="text-[10px] text-slate-500 dark:text-white/40 tabular-nums shrink-0">
          {formatTimeHHMMSSFF(currentTime)} / {formatTimeHHMMSSFF(duration)}
          <span className="ml-1.5 px-1 rounded bg-slate-200/50 dark:bg-white/[0.06] text-slate-600 dark:text-white/50 text-[9px] font-mono">
            {volumeDb > -40 ? `${volumeDb > 0 ? '+' : ''}${volumeDb} dB` : 'Muted'}
          </span>
        </span>

        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.01"
          value={currentTime}
          onChange={(e) => {
            const val = Number(e.target.value);
            setCurrentTime(val);
            wsRef.current?.setTime(val);
            if (jlSpeedRef.current < 0) { clearReverseTimer(); jlSpeedRef.current = 0; setJlSpeed(0); }
          }}
          disabled={!isReady}
          className="flex-1 h-1 bg-slate-200 dark:bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-violet-600 dark:accent-violet-400 focus:outline-none"
        />

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-slate-500 dark:text-white/40 font-medium">Zoom:</span>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            value={Math.max(minZoom, zoom)}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            disabled={!isReady}
            className="w-24 h-1 bg-slate-200 dark:bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-violet-600 dark:accent-violet-400 focus:outline-none"
          />
          <span className="text-[10px] text-slate-500 dark:text-white/40 w-12 text-right tabular-nums">
            {Math.round(zoom)}px
          </span>
        </div>
      </div>

      {/* Shortcuts footer */}
      <span className="text-[9px] text-slate-400 dark:text-white/20 px-1">
        Space (pause/play) · ← → (skip 1s) · ⇧← / ⇧→ (skip 5s) · Ctrl+←/→ (start/end) · ⇧Left/⇧Right (±1 frame) · J/L (speed ladder: −4x↔−2x↔1x↔2x↔4x) · ↑↓ (vol dB) · Alt+Scroll (zoom)
      </span>
    </div>
  );
}
