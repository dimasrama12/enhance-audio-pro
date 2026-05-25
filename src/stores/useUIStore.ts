import { create } from 'zustand';

export type AppTab = 'audio' | 'video';

interface UIState {
  sidebarVisible: boolean;
  activeTab: AppTab;
  settingsOpen: boolean;
  focusSearchTick: number;
  toggleSidebar: () => void;
  setSidebarVisible: (v: boolean) => void;
  setActiveTab: (tab: AppTab) => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  requestFocusSearch: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarVisible: true,
  activeTab: 'audio',
  settingsOpen: false,
  focusSearchTick: 0,
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  requestFocusSearch: () => set((s) => ({ focusSearchTick: s.focusSearchTick + 1 })),
}));
