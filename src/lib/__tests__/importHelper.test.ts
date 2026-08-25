import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { startBackgroundImport } from '@/lib/importHelper';
import { triggerEnhanceAll } from '@/lib/queueActions';
import type { QueueJob } from '@/types/queue';

const mockJob: QueueJob = {
  id: 'job-1',
  filename: 'test.wav',
  filepath: '/tmp/test.wav',
  destination: '',
  size_bytes: 0,
  media_type: 'audio',
  status: 'pending',
  progress: 0,
  error_message: null,
  output_format: 'wav',
  bitrate: '',
  output_filepath: null,
  download_path: null,
  sample_rate: '',
  created_at: '',
  updated_at: '',
};

vi.mock('@/lib/ipc', () => ({
  invokeAddFiles: vi.fn(),
  invokeSetDestination: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
  invokeSetOutputFormat: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
  invokeExtractVideoAudio: vi.fn(),
}));

vi.mock('@/lib/audioPreload', () => ({ prewarmAudio: vi.fn() }));

vi.mock('@/lib/queueActions', () => ({
  triggerEnhanceAll: vi.fn().mockResolvedValue(undefined),
  triggerConvertAll: vi.fn().mockResolvedValue(undefined),
  triggerCancelAll: vi.fn().mockResolvedValue(undefined),
}));

const TAB = 'enhance' as const;

describe('startBackgroundImport — auto-enhance on drop', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useQueueStore.setState({
      tabQueues: { enhance: [], convert: [] },
      tabFilters: { enhance: 'all', convert: 'all' },
      tabSearches: { enhance: '', convert: '' },
      tabSelectedIds: { enhance: [], convert: [] },
      tabLockedIds: { enhance: [], convert: [] },
      tabImportingIds: { enhance: [], convert: [] },
      tabViewModes: { enhance: 'table', convert: 'table' },
      tabGroupByFormat: { enhance: false, convert: false },
      tabJobOpTypes: { enhance: {}, convert: {} },
    });
    useSettingsStore.setState({ autoEnhanceOnDrop: true, outputFolder: '' });
    const { invokeAddFiles } = await import('@/lib/ipc');
    vi.mocked(invokeAddFiles).mockResolvedValue({ success: true, data: [mockJob], error: null });
  });

  it('calls triggerEnhanceAll after file resolves when autoEnhanceOnDrop is true', async () => {
    startBackgroundImport([{ path: '/tmp/test.wav', isVideo: false }], 0, TAB);
    await vi.waitFor(() => expect(triggerEnhanceAll).toHaveBeenCalledOnce(), { timeout: 2000 });
  });

  it('does not call triggerEnhanceAll when autoEnhanceOnDrop is false', async () => {
    useSettingsStore.setState({ autoEnhanceOnDrop: false, outputFolder: '' });
    startBackgroundImport([{ path: '/tmp/test.wav', isVideo: false }], 0, TAB);
    await new Promise<void>((r) => setTimeout(r, 150));
    expect(triggerEnhanceAll).not.toHaveBeenCalled();
  });
});
