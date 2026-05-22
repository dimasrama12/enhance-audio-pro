export interface AppSettings {
  theme: 'dark' | 'light';
  outputFolder: string;
  language: string;
  setupComplete: boolean;
  enhancementStrength: number;
  filenameTemplate: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  outputFolder: '',
  language: 'en',
  setupComplete: false,
  enhancementStrength: 50,
  filenameTemplate: '{name}_enhanced',
};
