import { create } from 'zustand';

export type AppTab = 'audio' | 'video';
export type AudioSubTab = 'enhance' | 'convert';

// A single file selected for import. Videos are extracted to audio in the
// background; audio files are added directly. Duplicate detection runs on the
// source path BEFORE any background work so re-adds surface the duplicate modal.
export interface ImportItem {
  path: string;
  isVideo: boolean;
}

export interface DuplicatePending {
  // Every valid item from the drop (used by "Add All / re-add duplicates").
  allItems: ImportItem[];
  // Only the items whose source path is not already in the queue.
  uniqueItems: ImportItem[];
  // Display names of the duplicate items, shown in the modal list.
  duplicateNames: string[];
  skippedInvalid: number;
}

interface UIState {
  sidebarVisible: boolean;
  activeTab: AppTab;
  audioSubTab: AudioSubTab;
  settingsOpen: boolean;
  historyOpen: boolean;
  focusSearchTick: number;
  playerOpen: boolean;
  activePlayerJobId: string | null;
  duplicatePending: DuplicatePending | null;
  // Auto re-enhance: when ON, changing strength/HF sliders triggers re-enhancement
  // on done jobs in the enhance tab (with 800ms debounce).
  autoReEnhance: boolean;
  toggleSidebar: () => void;
  setSidebarVisible: (v: boolean) => void;
  setActiveTab: (tab: AppTab) => void;
  setAudioSubTab: (tab: AudioSubTab) => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  toggleHistory: () => void;
  requestFocusSearch: () => void;
  setPlayerOpen: (open: boolean) => void;
  setActivePlayerJobId: (id: string | null) => void;
  setDuplicatePending: (pending: DuplicatePending | null) => void;
  setAutoReEnhance: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarVisible: true,
  activeTab: 'audio',
  audioSubTab: 'enhance',
  settingsOpen: false,
  historyOpen: false,
  focusSearchTick: 0,
  playerOpen: false,
  activePlayerJobId: null,
  duplicatePending: null,
  autoReEnhance: false,
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setAudioSubTab: (audioSubTab) => set({ audioSubTab }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  openHistory: () => set({ historyOpen: true }),
  closeHistory: () => set({ historyOpen: false }),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  requestFocusSearch: () => set((s) => ({ focusSearchTick: s.focusSearchTick + 1 })),
  setPlayerOpen: (playerOpen) => set({ playerOpen }),
  setActivePlayerJobId: (activePlayerJobId) => set({ activePlayerJobId }),
  setDuplicatePending: (duplicatePending) => set({ duplicatePending }),
  setAutoReEnhance: (autoReEnhance) => set({ autoReEnhance }),
}));

