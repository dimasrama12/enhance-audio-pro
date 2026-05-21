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
  progress: 0,
  error_message: null,
  output_format: 'wav',
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

  it('setProgress updates progress on the matching job only', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: 'a', progress: 0 }), makeJob({ id: 'b', progress: 0 })],
    });
    useQueueStore.getState().setProgress('a', 50);
    const jobs = useQueueStore.getState().jobs;
    expect(jobs.find((j) => j.id === 'a')?.progress).toBe(50);
    expect(jobs.find((j) => j.id === 'b')?.progress).toBe(0);
  });

  it('setStatus updates status and keeps error_message null when not provided', () => {
    useQueueStore.setState({ jobs: [makeJob({ id: 'x', status: 'pending' })] });
    useQueueStore.getState().setStatus('x', 'processing');
    const job = useQueueStore.getState().jobs[0];
    expect(job.status).toBe('processing');
    expect(job.error_message).toBeNull();
  });

  it('setStatus records error_message when status is error', () => {
    useQueueStore.setState({ jobs: [makeJob({ id: 'y', status: 'processing' })] });
    useQueueStore.getState().setStatus('y', 'error', 'Model not found');
    const job = useQueueStore.getState().jobs[0];
    expect(job.status).toBe('error');
    expect(job.error_message).toBe('Model not found');
  });

  it('setOutputFormat updates output_format for the matching job', () => {
    const job: QueueJob = {
      id: 'job-1', filename: 'a.mp3', filepath: '/a.mp3', destination: '',
      size_bytes: 100, media_type: 'audio', status: 'pending', progress: 0,
      error_message: null, output_format: 'wav', created_at: '', updated_at: '',
    };
    useQueueStore.getState().setJobs([job]);
    useQueueStore.getState().setOutputFormat('job-1', 'mp3');
    expect(useQueueStore.getState().jobs[0].output_format).toBe('mp3');
  });
});
