import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Mic, Square } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeSaveRecording, invokeAddFiles } from '@/lib/ipc';

export default function RecordButton(): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const addJobs = useQueueStore((s) => s.addJobs);

  async function startRecording(): Promise<void> {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording-${timestamp}.webm`;
        const res = await invokeSaveRecording(bytes, filename);
        if (res.success && res.data) {
          const addRes = await invokeAddFiles([res.data]);
          if (addRes.success && addRes.data) addJobs(addRes.data);
        } else {
          setError(res.error ?? 'Failed to save recording');
        }
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied');
    }
  }

  function stopRecording(): void {
    mediaRef.current?.stop();
    mediaRef.current = null;
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
