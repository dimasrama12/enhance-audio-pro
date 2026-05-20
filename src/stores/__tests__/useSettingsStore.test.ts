import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../useSettingsStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, initialized: false });
  });

  it('has dark theme by default', () => {
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('sets theme', () => {
    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('marks setup complete', () => {
    useSettingsStore.getState().markSetupComplete();
    expect(useSettingsStore.getState().setupComplete).toBe(true);
  });

  it('sets output folder', () => {
    useSettingsStore.getState().setOutputFolder('D:\\Output');
    expect(useSettingsStore.getState().outputFolder).toBe('D:\\Output');
  });
});
