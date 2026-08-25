// Inline AudioWorkletProcessor loaded via Blob URL — no separate worker file needed.
const PROCESSOR_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}
registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
`;

let processorBlobUrl: string | null = null;

function getProcessorBlobUrl(): string {
  if (!processorBlobUrl) {
    const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' });
    processorBlobUrl = URL.createObjectURL(blob);
  }
  return processorBlobUrl;
}

export interface AudioCaptureHandle {
  stop: () => void;
  getSamples: () => Float32Array[];
  sampleRate: number;
}

export async function startCapture(stream: MediaStream): Promise<AudioCaptureHandle> {
  const audioCtx = new AudioContext();
  await audioCtx.audioWorklet.addModule(getProcessorBlobUrl());

  const source = audioCtx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');

  // Route through a silent gain node to keep the graph active without playing audio.
  const silence = audioCtx.createGain();
  silence.gain.value = 0;
  source.connect(worklet);
  worklet.connect(silence);
  silence.connect(audioCtx.destination);

  const chunks: Float32Array[] = [];
  worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data);
  };

  return {
    stop: () => {
      source.disconnect();
      worklet.disconnect();
      worklet.port.close();
      stream.getTracks().forEach((t) => t.stop());
      void audioCtx.close();
    },
    getSamples: () => chunks,
    sampleRate: audioCtx.sampleRate,
  };
}
