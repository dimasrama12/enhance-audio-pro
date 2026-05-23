export interface KeyboardShortcutMap {
  enhance: string;
  separate: string;
  convert: string;
  selectAll: string;
  deselect: string;
  deleteSelected: string;
  openFiles: string;
  focusSearch: string;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutMap = {
  enhance: 'E',
  separate: 'S',
  convert: 'C',
  selectAll: 'Ctrl+A',
  deselect: 'Escape',
  deleteSelected: 'Delete',
  openFiles: 'Ctrl+O',
  focusSearch: 'Shift+F',
};

export const SHORTCUT_LABELS: Record<keyof KeyboardShortcutMap, string> = {
  enhance: 'Enhance Speech',
  separate: 'Separate Stems',
  convert: 'Convert Format',
  selectAll: 'Select All',
  deselect: 'Deselect',
  deleteSelected: 'Delete Selected',
  openFiles: 'Open Files',
  focusSearch: 'Focus Search',
};

export interface AppSettings {
  theme: 'dark' | 'light';
  outputFolder: string;
  language: string;
  setupComplete: boolean;
  enhancementStrength: number;
  filenameTemplate: string;
  keyboardShortcuts: KeyboardShortcutMap;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  outputFolder: '',
  language: 'en',
  setupComplete: false,
  enhancementStrength: 50,
  filenameTemplate: '{name}_enhanced',
  keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS },
};
