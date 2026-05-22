import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState extends AppSettings {
  initialized: boolean;
  setSettings: (s: AppSettings) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setOutputFolder: (folder: string) => void;
  setLanguage: (language: string) => void;
  setEnhancementStrength: (v: number) => void;
  markSetupComplete: () => void;
  setInitialized: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      initialized: false,
      setSettings: (s) => set({ ...s }),
      setTheme: (theme) => set({ theme }),
      setOutputFolder: (outputFolder) => set({ outputFolder }),
      setLanguage: (language) => set({ language }),
      setEnhancementStrength: (enhancementStrength) => set({ enhancementStrength }),
      markSetupComplete: () => set({ setupComplete: true }),
      setInitialized: (initialized) => set({ initialized }),
    }),
    {
      name: 'settings-ui-cache',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        enhancementStrength: state.enhancementStrength,
      }),
    }
  )
);
