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
  // View
  tableView: string;
  gridView: string;
  // Sub-tab switch
  tabEnhance: string;
  tabConvert: string;
  tabSeparate: string;
  // History
  openHistory: string;
  // Window
  toggleFullscreen: string;
  openSettings: string;
  exit: string;
  // Theme
  themeLight: string;
  themeDark: string;
  closePlayer: string;
}

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutMap = {
  enhance: 'E',
  separate: 'S',
  convert: 'C',
  openFiles: 'Ctrl+O',
  selectAll: 'Ctrl+A',
  deselect: 'Escape',
  deselectAll: 'X',
  deleteSelected: 'Delete',
  lockSelected: 'L',
  lockAll: 'Shift+L',
  audioTab: 'Ctrl+1',
  videoTab: 'Ctrl+2',
  toggleSidebar: 'Ctrl+B',
  focusSearch: 'Shift+F',
  browseFolder: 'Ctrl+Shift+O',
  tableView: 'shift+1',
  gridView: 'shift+2',
  tabEnhance: '1',
  tabConvert: '2',
  tabSeparate: '3',
  openHistory: 'Ctrl+H',
  toggleFullscreen: 'F',
  openSettings: 'Ctrl+,',
  exit: 'Alt+X',
  themeLight: ']',
  themeDark: '[',
  closePlayer: 'W',
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
  browseFolder: 'Import Files from Folder',
  tableView: 'Switch to Table View',
  gridView: 'Switch to Grid View',
  tabEnhance: 'Switch to Enhance Tab',
  tabConvert: 'Switch to Convert Tab',
  tabSeparate: 'Switch to Separate Tab',
  openHistory: 'Open File History',
  toggleFullscreen: 'Toggle Fullscreen',
  openSettings: 'Open Settings',
  exit: 'Exit App',
  themeLight: 'Light Theme',
  themeDark: 'Dark Theme',
  closePlayer: 'Close Waveform Player',
};

export interface AppSettings {
  theme: 'dark' | 'light';
  outputFolder: string;
  language: string;
  setupComplete: boolean;
  enhancementStrength: number;
  filenameTemplate: string;
  keyboardShortcuts: KeyboardShortcutMap;
  customDefaultShortcuts?: KeyboardShortcutMap;
  recordingPrefix?: string;
  aiModel: 'deepfilternet' | 'lavasr';
  scratchDiskDir?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  outputFolder: '',
  language: 'en',
  setupComplete: true,
  enhancementStrength: 50,
  filenameTemplate: '{name}_enhanced',
  keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS },
  customDefaultShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS },
  recordingPrefix: 'Record',
  aiModel: 'deepfilternet',
  scratchDiskDir: '',
};
