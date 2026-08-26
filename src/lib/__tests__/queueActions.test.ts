import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import type { QueueJob, EnhanceRun } from '@/types/queue';

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

// ── autoAdvanceQueue ──────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = {
  enhancementStrength: 50,
  hfDeHissDb: -4 as number,
  aiModel: 'deepfilternet' as const,
  filenameTemplateConverted: '',
};

describe('autoAdvanceQueue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useQueueStore.setState(STORE_DEFAULTS);
    useSettingsStore.setState(SETTINGS_DEFAULTS);
    useUIStore.setState({ audioSubTab: 'enhance' });
    const { _resetDispatchGuardForTest } = await import('@/lib/queueActions');
    _resetDispatchGuardForTest();
  });

  it('dispatches the next queued job when nothing is processing', async () => {
    const { autoAdvanceQueue } = await import('@/lib/queueActions');
    const { invokeProcessQueue } = await import('@/lib/ipc');
    const jobB = makeJob('b', 'queued');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [jobB], convert: [] } });

    await autoAdvanceQueue('enhance');

    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledWith(['b'], 50, 'deepfilternet', -4);
  });

  it('does NOT dispatch when another job is currently processing', async () => {
    const { autoAdvanceQueue } = await import('@/lib/queueActions');
    const { invokeProcessQueue } = await import('@/lib/ipc');
    const jobA = makeJob('a', 'processing');
    const jobB = makeJob('b', 'queued');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [jobA, jobB], convert: [] } });

    await autoAdvanceQueue('enhance');

    expect(vi.mocked(invokeProcessQueue)).not.toHaveBeenCalled();
  });

  it('does NOT dispatch when there are no queued jobs', async () => {
    const { autoAdvanceQueue } = await import('@/lib/queueActions');
    const { invokeProcessQueue } = await import('@/lib/ipc');
    const jobA = makeJob('a', 'done');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [jobA], convert: [] } });

    await autoAdvanceQueue('enhance');

    expect(vi.mocked(invokeProcessQueue)).not.toHaveBeenCalled();
  });

  it('does NOT dispatch the same job twice when called twice in rapid succession', async () => {
    const { autoAdvanceQueue } = await import('@/lib/queueActions');
    const { invokeProcessQueue } = await import('@/lib/ipc');
    const jobB = makeJob('b', 'queued');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [jobB], convert: [] } });

    await autoAdvanceQueue('enhance');
    await autoAdvanceQueue('enhance'); // simulates duplicate event within the race window

    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledOnce(); // guard blocks second dispatch
  });

  it('allows dispatch again after clearDispatchGuard confirms the job started processing', async () => {
    const { autoAdvanceQueue, clearDispatchGuard } = await import('@/lib/queueActions');
    const { invokeProcessQueue } = await import('@/lib/ipc');
    const jobB = makeJob('b', 'queued');
    const jobC = makeJob('c', 'queued');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [jobB, jobC], convert: [] } });

    await autoAdvanceQueue('enhance');   // dispatches B
    clearDispatchGuard('b');             // simulates 'processing' event for B

    useQueueStore.setState({
      ...STORE_DEFAULTS,
      tabQueues: { enhance: [{ ...jobB, status: 'done' }, jobC], convert: [] },
    });
    await autoAdvanceQueue('enhance');   // now dispatches C

    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invokeProcessQueue)).toHaveBeenNthCalledWith(1, ['b'], 50, 'deepfilternet', -4);
    expect(vi.mocked(invokeProcessQueue)).toHaveBeenNthCalledWith(2, ['c'], 50, 'deepfilternet', -4);
  });

  it('dispatches via invokeConvertFiles for convert-mode jobs', async () => {
    const { autoAdvanceQueue } = await import('@/lib/queueActions');
    const { invokeProcessQueue, invokeConvertFiles } = await import('@/lib/ipc');
    const jobB = makeJob('b', 'queued');
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      tabQueues: { enhance: [], convert: [jobB] },
      tabJobOpTypes: { enhance: {}, convert: { b: 'convert' } },
    });

    await autoAdvanceQueue('convert');

    expect(vi.mocked(invokeConvertFiles)).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeProcessQueue)).not.toHaveBeenCalled();
  });
});

// ── handleJobError (auto-retry, P2-C revised) ─────────────────────────────────

describe('handleJobError', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useQueueStore.setState(STORE_DEFAULTS);
    useSettingsStore.setState(SETTINGS_DEFAULTS);
    useUIStore.setState({ audioSubTab: 'enhance' });
    const { _resetDispatchGuardForTest, _resetRetryCountsForTest } = await import('@/lib/queueActions');
    _resetDispatchGuardForTest();
    _resetRetryCountsForTest();
  });

  it('resets the errored job to queued and re-dispatches on first error', async () => {
    const { handleJobError } = await import('@/lib/queueActions');
    const { invokeProcessQueue, invokeSetJobStatus } = await import('@/lib/ipc');
    const job = makeJob('err-a', 'error');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [job], convert: [] } });

    await handleJobError('err-a', 'enhance');

    expect(vi.mocked(invokeSetJobStatus)).toHaveBeenCalledWith('err-a', 'queued');
    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledOnce();
  });

  it('re-dispatches the same job on second error (retry 2)', async () => {
    const { handleJobError } = await import('@/lib/queueActions');
    const { invokeProcessQueue } = await import('@/lib/ipc');
    const job = makeJob('err-b', 'error');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [job], convert: [] } });

    await handleJobError('err-b', 'enhance'); // retry 1
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [{ ...job, status: 'queued' }], convert: [] } });
    await handleJobError('err-b', 'enhance'); // retry 2

    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-queue the job after the max retry count is exhausted', async () => {
    const { handleJobError } = await import('@/lib/queueActions');
    const { invokeSetJobStatus } = await import('@/lib/ipc');
    const errJob = makeJob('err-c', 'error');
    const nextJob = makeJob('next-c', 'queued');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [errJob, nextJob], convert: [] } });

    // Exhaust all retries
    const MAX = 3;
    for (let i = 0; i < MAX; i++) {
      await handleJobError('err-c', 'enhance');
    }

    vi.mocked(invokeSetJobStatus).mockClear();
    vi.mocked(invokeSetJobStatus).mockResolvedValue({ success: true, data: null, error: null });
    const { invokeProcessQueue } = await import('@/lib/ipc');
    vi.mocked(invokeProcessQueue).mockClear();

    // Next call: retries exhausted → should NOT re-queue err-c, should advance queue
    await handleJobError('err-c', 'enhance');

    const setStatusCalls = vi.mocked(invokeSetJobStatus).mock.calls;
    expect(setStatusCalls.every(([id]) => id !== 'err-c')).toBe(true);
    // Should have dispatched next-c instead
    expect(vi.mocked(invokeProcessQueue)).toHaveBeenCalledWith(['next-c'], 50, 'deepfilternet', -4);
  });

  it('willRetry returns true when below max, false after exhaustion', async () => {
    const { handleJobError, willRetry } = await import('@/lib/queueActions');
    const job = makeJob('wrt', 'error');
    useQueueStore.setState({ ...STORE_DEFAULTS, tabQueues: { enhance: [job], convert: [] } });

    expect(willRetry('wrt')).toBe(true); // not yet retried

    const MAX = 3;
    for (let i = 0; i < MAX; i++) {
      await handleJobError('wrt', 'enhance');
    }

    expect(willRetry('wrt')).toBe(false); // exhausted
  });
});

// ── triggerEnhanceAll run snapshot (P1-A) ────────────────────────────────────

describe('triggerEnhanceAll run snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState({ ...STORE_DEFAULTS, enhanceRuns: [] } as Parameters<typeof useQueueStore.setState>[0]);
    useSettingsStore.setState({ enhancementStrength: 60, hfDeHissDb: -5, aiModel: 'deepfilternet' as const, filenameTemplateConverted: '' });
    useUIStore.setState({ audioSubTab: 'enhance' });
  });

  it('creates a run record with the current strength, hf and job IDs', async () => {
    const { triggerEnhanceAll } = await import('@/lib/queueActions');
    const job = makeJob('snap-1', 'pending');
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      enhanceRuns: [],
      tabQueues: { enhance: [job], convert: [] },
    } as Parameters<typeof useQueueStore.setState>[0]);

    await triggerEnhanceAll();

    const state = useQueueStore.getState() as { enhanceRuns: EnhanceRun[] };
    expect(state.enhanceRuns).toHaveLength(1);
    expect(state.enhanceRuns[0].strength).toBe(60);
    expect(state.enhanceRuns[0].hfDeHissDb).toBe(-5);
    expect(state.enhanceRuns[0].jobIds).toContain('snap-1');
  });

  it('does NOT create a run record when there are no eligible jobs', async () => {
    const { triggerEnhanceAll } = await import('@/lib/queueActions');
    const doneJob = makeJob('snap-done', 'done');
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      enhanceRuns: [],
      tabQueues: { enhance: [doneJob], convert: [] },
    } as Parameters<typeof useQueueStore.setState>[0]);

    await triggerEnhanceAll();

    const state = useQueueStore.getState() as { enhanceRuns: EnhanceRun[] };
    expect(state.enhanceRuns).toHaveLength(0);
  });

  it('accumulates multiple run records across calls', async () => {
    const { triggerEnhanceAll } = await import('@/lib/queueActions');
    const job1 = makeJob('snap-r1', 'pending');
    useQueueStore.setState({
      ...STORE_DEFAULTS,
      enhanceRuns: [],
      tabQueues: { enhance: [job1], convert: [] },
    } as Parameters<typeof useQueueStore.setState>[0]);
    await triggerEnhanceAll();

    const job2 = makeJob('snap-r2', 'pending');
    useQueueStore.setState({ tabQueues: { enhance: [job2], convert: [] } });
    await triggerEnhanceAll();

    const state = useQueueStore.getState() as { enhanceRuns: EnhanceRun[] };
    expect(state.enhanceRuns).toHaveLength(2);
  });
});
