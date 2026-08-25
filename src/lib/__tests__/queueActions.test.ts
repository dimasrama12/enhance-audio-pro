import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import type { QueueJob } from '@/types/queue';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeJob = (id: string, status: QueueJob['status'] = 'done'): QueueJob => ({
  id,
  filename: `${id}.wav`,
  filepath: `/tmp/${id}.wav`,
  destination: '',
  size_bytes: 0,
  media_type: 'audio',
  status,
  progress: 0,
  error_message: null,
  output_format: 'wav',
  bitrate: '',
  output_filepath: `/tmp/${id}_enhanced.wav`,
  download_path: null,
  sample_rate: '',
  created_at: '',
  updated_at: '',
});

vi.mock('@/lib/ipc', () => ({
  invokeAddFiles: vi.fn(),
  invokeProcessQueue: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
  invokeSetJobStatus: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
  invokeCancelJobs: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
  invokeConvertFiles: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
  invokeSetOutputFormat: vi.fn().mockResolvedValue({ success: true, data: null, error: null }),
}));

vi.mock('@/lib/errorLogger', () => ({ logError: vi.fn() }));

const STORE_DEFAULTS = {
  tabQueues: { enhance: [] as QueueJob[], convert: [] as QueueJob[] },
  tabFilters: { enhance: 'all', convert: 'all' },
  tabSearches: { enhance: '', convert: '' },
  tabSelectedIds: { enhance: [] as string[], convert: [] as string[] },
  tabLockedIds: { enhance: [] as string[], convert: [] as string[] },
  tabImportingIds: { enhance: [] as string[], convert: [] as string[] },
  tabViewModes: { enhance: 'table' as const, convert: 'table' as const },
  tabGroupByFormat: { enhance: false, convert: false },
  tabJobOpTypes: { enhance: {} as Record<string, 'enhance' | 'convert'>, convert: {} as Record<string, 'enhance' | 'convert'> },
};

// ── triggerReEnhance ──────────────────────────────────────────────────────────

describe('triggerReEnhance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState(STORE_DEFAULTS);
    useSettingsStore.setState({
      enhancementStrength: 50,
      hfDeHissDb: -4,
      aiModel: 'deepfilternet',
    });
    useUIStore.setState({ audioSubTab: 'enhance' });
  });

  it('does nothing when no jobs are selected', async () => {
    const { triggerReEnhance } = await import('@/lib/queueActions');
    const { invokeAddFiles } = await import('@/lib/ipc');
    await triggerReEnhance();
    expect(vi.mocked(invokeAddFiles)).not.toHaveBeenCalled();
  });

  it('does nothing when all selected jobs are pending', async () => {
    const { triggerReEnhance } = await import('@/lib/queueActions');
    const { invokeAddFiles } = await import('@/lib/ipc');
    const job = makeJob('p1', 'pending');
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      tabQueues: { enhance: [job], convert: [] },
      tabSelectedIds: { enhance: ['p1'], convert: [] },
    });
    await triggerReEnhance();
    expect(vi.mocked(invokeAddFiles)).not.toHaveBeenCalled();
  });

  it('calls invokeAddFiles with the filepath of a single selected done job', async () => {
    const { triggerReEnhance } = await import('@/lib/queueActions');
    const { invokeAddFiles } = await import('@/lib/ipc');
    const job = makeJob('done-1');
    vi.mocked(invokeAddFiles).mockResolvedValue({
      success: true,
      data: [{ ...job, id: 'new-1', status: 'pending' as const }],
      error: null,
    });
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      tabQueues: { enhance: [job], convert: [] },
      tabSelectedIds: { enhance: ['done-1'], convert: [] },
    });
    await triggerReEnhance();
    expect(vi.mocked(invokeAddFiles)).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeAddFiles)).toHaveBeenCalledWith([job.filepath]);
  });

  it('calls invokeAddFiles separately for each done job when multiple are selected', async () => {
    const { triggerReEnhance } = await import('@/lib/queueActions');
    const { invokeAddFiles } = await import('@/lib/ipc');
    const job1 = makeJob('d1');
    const job2 = makeJob('d2');
    vi.mocked(invokeAddFiles)
      .mockResolvedValueOnce({ success: true, data: [{ ...job1, id: 'n1', status: 'pending' as const }], error: null })
      .mockResolvedValueOnce({ success: true, data: [{ ...job2, id: 'n2', status: 'pending' as const }], error: null });
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      tabQueues: { enhance: [job1, job2], convert: [] },
      tabSelectedIds: { enhance: ['d1', 'd2'], convert: [] },
    });
    await triggerReEnhance();
    expect(vi.mocked(invokeAddFiles)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invokeAddFiles)).toHaveBeenNthCalledWith(1, [job1.filepath]);
    expect(vi.mocked(invokeAddFiles)).toHaveBeenNthCalledWith(2, [job2.filepath]);
  });

  it('skips non-done jobs when selection contains a mix of statuses', async () => {
    const { triggerReEnhance } = await import('@/lib/queueActions');
    const { invokeAddFiles } = await import('@/lib/ipc');
    const doneJob = makeJob('d-mixed');
    const pendingJob = makeJob('p-mixed', 'pending');
    vi.mocked(invokeAddFiles).mockResolvedValue({
      success: true,
      data: [{ ...doneJob, id: 'new-mixed', status: 'pending' as const }],
      error: null,
    });
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      tabQueues: { enhance: [doneJob, pendingJob], convert: [] },
      tabSelectedIds: { enhance: ['d-mixed', 'p-mixed'], convert: [] },
    });
    await triggerReEnhance();
    expect(vi.mocked(invokeAddFiles)).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeAddFiles)).toHaveBeenCalledWith([doneJob.filepath]);
  });
});
