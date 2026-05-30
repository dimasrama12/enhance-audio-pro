import { create } from 'zustand';

let _audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'none';
  }
  return _audio;
}

function toTauriSrc(filePath: string): string {
  return `tauri://localhost/${filePath.replace(/\\/g, '/')}`;
}

interface AudioPlayerState {
  playingJobId: string | null;
  isPlaying: boolean;
  play: (jobId: string, filePath: string) => void;
  pause: () => void;
  stop: () => void;
  toggle: (jobId: string, filePath: string) => void;
}

export const useAudioPlayer = create<AudioPlayerState>()((set, get) => ({
  playingJobId: null,
  isPlaying: false,

  play: (jobId, filePath) => {
    const audio = getAudio();
    const src = toTauriSrc(filePath);

    if (!audio.paused) audio.pause();

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    audio.onended = () => set({ isPlaying: false });
    audio.onpause = () => {
      if (get().playingJobId === jobId) set({ isPlaying: false });
    };

    audio.play().catch(() => set({ isPlaying: false }));
    set({ playingJobId: jobId, isPlaying: true });
  },

  pause: () => {
    getAudio().pause();
    set({ isPlaying: false });
  },

  stop: () => {
    const audio = getAudio();
    audio.pause();
    audio.currentTime = 0;
    set({ playingJobId: null, isPlaying: false });
  },

  toggle: (jobId, filePath) => {
    const { playingJobId, isPlaying } = get();
    if (playingJobId === jobId && isPlaying) {
      get().pause();
    } else {
      get().play(jobId, filePath);
    }
  },
}));
