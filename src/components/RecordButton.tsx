import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Mic, Square } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveRecording, invokeAddFiles } from '@/lib/ipc';
import { startCapture, type AudioCaptureHandle } from '@/lib/audioCapture';

// Encode raw float32 PCM samples as a WAV file (mono, 16-bit).
function encodePCMToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return buffer;
}

// Session-scoped counter — resets when the app is reloaded.
let sessionRecordingCount = 0;

export default function RecordButton(): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addJobs = useQueueStore((s) => s.addJobs);
  const recordingPrefix = useSettingsStore((s) => s.recordingPrefix ?? 'Record');

  const captureRef = useRef<AudioCaptureHandle | null>(null);

  async function startRecording(): Promise<void> {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      captureRef.current = await startCapture(stream);
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied');
    }
  }

  async function stopRecording(): Promise<void> {
    const capture = captureRef.current;
    if (!capture) return;

    const { sampleRate } = capture;
    capture.stop();
    captureRef.current = null;

    const chunks = capture.getSamples();
    if (chunks.length > 0) {
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Float32Array(total);
      let off = 0;
      for (const chunk of chunks) { combined.set(chunk, off); off += chunk.length; }

      const wavBuffer = encodePCMToWav(combined, sampleRate);
      const bytes = Array.from(new Uint8Array(wavBuffer));

      sessionRecordingCount += 1;
      const num = sessionRecordingCount.toString().padStart(2, '0');
      const filename = `${num}_${recordingPrefix}.wav`;

      try {
        const res = await invokeSaveRecording(bytes, filename);
        if (res.success && res.data) {
          const addRes = await invokeAddFiles([res.data]);
          if (addRes.success && addRes.data) addJobs(addRes.data);
        } else {
          setError(res.error ?? 'Failed to save recording');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    }

    setRecording(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={recording ? stopRecording : startRecording}
        title={recording ? 'Stop recording' : 'Record audio from microphone'}
        className={clsx(
          'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 h-[32px] shrink-0',
          recording
            ? 'bg-red-500 hover:bg-red-400 text-white ring-2 ring-red-500/30'
            : 'bg-slate-200 dark:bg-white/[0.06] hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300',
        )}
      >
        {recording ? <Square size={13} /> : <Mic size={13} />}
        <span>{recording ? 'Stop' : 'Record'}</span>
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
