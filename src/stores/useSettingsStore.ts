import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, KeyboardShortcutMap } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState extends AppSettings {
  initialized: boolean;
  setSettings: (s: AppSettings) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setOutputFolder: (folder: string) => void;
  setLanguage: (language: string) => void;
  setEnhancementStrength: (v: number) => void;
  setFilenameTemplate: (t: string) => void;
  setFilenameTemplateConverted: (t: string) => void;
  setKeyboardShortcuts: (shortcuts: KeyboardShortcutMap) => void;
  setCustomDefaultShortcuts: (shortcuts: KeyboardShortcutMap) => void;
  setRecordingPrefix: (prefix: string) => void;
  setAiModel: (model: 'deepfilternet') => void;
  setScratchDiskDir: (dir: string) => void;
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
      setFilenameTemplate: (filenameTemplate) => set({ filenameTemplate }),
      setFilenameTemplateConverted: (filenameTemplateConverted) => set({ filenameTemplateConverted }),
      setKeyboardShortcuts: (keyboardShortcuts) => set({ keyboardShortcuts }),
      setCustomDefaultShortcuts: (customDefaultShortcuts) => set({ customDefaultShortcuts }),
      setRecordingPrefix: (recordingPrefix) => set({ recordingPrefix }),
      setAiModel: (aiModel: 'deepfilternet') => set({ aiModel }),
      setScratchDiskDir: (scratchDiskDir) => set({ scratchDiskDir }),
      markSetupComplete: () => set({ setupComplete: true }),
      setInitialized: (initialized) => set({ initialized }),
    }),
    {
      name: 'settings-ui-cache',
      partialize: (state) => ({
        theme: state.theme,
        outputFolder: state.outputFolder,
        language: state.language,
        enhancementStrength: state.enhancementStrength,
        filenameTemplate: state.filenameTemplate,
        filenameTemplateConverted: state.filenameTemplateConverted,
        keyboardShortcuts: state.keyboardShortcuts,
        customDefaultShortcuts: state.customDefaultShortcuts,
        recordingPrefix: state.recordingPrefix,
        aiModel: state.aiModel,
        scratchDiskDir: state.scratchDiskDir,
      }),
    }
  )
);
