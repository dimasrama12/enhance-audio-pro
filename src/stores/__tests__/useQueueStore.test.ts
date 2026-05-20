import { describe, it, expect, beforeEach } from 'vitest';
import { useQueueStore } from '../useQueueStore';
import type { QueueJob } from '@/types/queue';

const makeJob = (overrides: Partial<QueueJob> = {}): QueueJob => ({
  id: 'test-id',
  filename: 'test.mp3',
  filepath: '/tmp/test.mp3',
  destination: '',
  size_bytes: 1024,
  media_type: 'audio',
  status: 'pending',
  created_at: '2026-05-20T00:00:00Z',
  updated_at: '2026-05-20T00:00:00Z',
  ...overrides,
});

describe('useQueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ jobs: [], filter: 'all', searchQuery: '' });
  });

  it('adds jobs', () => {
    useQueueStore.getState().addJobs([makeJob()]);
    expect(useQueueStore.getState().jobs).toHaveLength(1);
  });

  it('filters by status', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: '1', status: 'pending' }), makeJob({ id: '2', status: 'done' })],
      filter: 'done',
    });
    const results = useQueueStore.getState().filteredJobs();
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('done');
  });

  it('filters by search query', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: '1', filename: 'podcast.mp3' }), makeJob({ id: '2', filename: 'music.wav' })],
      searchQuery: 'podcast',
    });
    expect(useQueueStore.getState().filteredJobs()).toHaveLength(1);
  });

  it('clears queue', () => {
    useQueueStore.setState({ jobs: [makeJob()] });
    useQueueStore.getState().clearQueue();
    expect(useQueueStore.getState().jobs).toHaveLength(0);
  });
});
