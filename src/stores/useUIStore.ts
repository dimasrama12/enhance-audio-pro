import { create } from 'zustand';

export type AppTab = 'audio' | 'video';

export interface DuplicatePending {
  newPaths: string[];
  uniquePaths: string[];
  duplicateNames: string[];
  skippedInvalid: number;
}

interface UIState {
  sidebarVisible: boolean;
  activeTab: AppTab;
  settingsOpen: boolean;
  historyOpen: boolean;
  focusSearchTick: number;
  playerOpen: boolean;
  activePlayerJobId: string | null;
  duplicatePending: DuplicatePending | null;
  importError: string | null;
  importLimitWarning: string | null;
  toggleSidebar: () => void;
  setSidebarVisible: (v: boolean) => void;
  setActiveTab: (tab: AppTab) => void;
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
  setImportError: (err: string | null) => void;
  setImportLimitWarning: (warn: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarVisible: true,
  activeTab: 'audio',
  settingsOpen: false,
  historyOpen: false,
  focusSearchTick: 0,
  playerOpen: false,
  activePlayerJobId: null,
  duplicatePending: null,
  importError: null,
  importLimitWarning: null,
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
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
  setImportError: (importError) => set({ importError }),
  setImportLimitWarning: (importLimitWarning) => set({ importLimitWarning }),
}));

