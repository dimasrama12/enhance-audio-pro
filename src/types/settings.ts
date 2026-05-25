export interface KeyboardShortcutMap {
  // Queue actions
  enhance: string;
  separate: string;
  convert: string;
  openFiles: string;
  // Selection
  selectAll: string;
  deselect: string;
  deselectAll: string;
  deleteSelected: string;
  lockSelected: string;
  lockAll: string;
  // Navigation
  audioTab: string;
  videoTab: string;
  toggleSidebar: string;
  focusSearch: string;
  browseFolder: string;
  // Window
  toggleFullscreen: string;
  openSettings: string;
  exit: string;
  // Theme
  themeLight: string;
  themeDark: string;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutMap = {
  enhance: 'E',
  separate: 'S',
  convert: 'C',
  openFiles: 'Ctrl+O',
  selectAll: 'Ctrl+A',
  deselect: 'Escape',
  deselectAll: 'X',
  deleteSelected: 'Shift+X',
  lockSelected: 'L',
  lockAll: 'Shift+L',
  audioTab: '1',
  videoTab: '2',
  toggleSidebar: 'Ctrl+B',
  focusSearch: 'Shift+F',
  browseFolder: 'Ctrl+Shift+O',
  toggleFullscreen: 'F',
  openSettings: 'Ctrl+,',
  exit: 'Alt+X',
  themeLight: ']',
  themeDark: '[',
};

export const SHORTCUT_LABELS: Record<keyof KeyboardShortcutMap, string> = {
  enhance: 'Enhance Speech',
  separate: 'Separate Stems',
  convert: 'Convert Format',
  openFiles: 'Open Files',
  selectAll: 'Select All',
  deselect: 'Cancel / Deselect',
  deselectAll: 'Deselect All',
  deleteSelected: 'Delete Selected',
  lockSelected: 'Lock Selected',
  lockAll: 'Lock All',
  audioTab: 'Audio Tab',
  videoTab: 'Video Tab',
  toggleSidebar: 'Toggle Sidebar',
  focusSearch: 'Focus Search',
  browseFolder: 'Browse Output Folder',
  toggleFullscreen: 'Toggle Fullscreen',
  openSettings: 'Open Settings',
  exit: 'Exit App',
  themeLight: 'Light Theme',
  themeDark: 'Dark Theme',
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
  setupComplete: true,
  enhancementStrength: 50,
  filenameTemplate: '{name}_enhanced',
  keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS },
};
