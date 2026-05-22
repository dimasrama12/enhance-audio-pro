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
  bitrate: '',
  output_filepath: null,
  created_at: '2026-05-20T00:00:00Z',
  updated_at: '2026-05-20T00:00:00Z',
  ...overrides,
});

describe('useQueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({
      jobs: [], filter: 'all', searchQuery: '', selectedJobIds: [], viewMode: 'table',
    });
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
    useQueueStore.getState().setJobs([makeJob({ id: 'job-1', output_format: 'wav' })]);
    useQueueStore.getState().setOutputFormat('job-1', 'mp3');
    expect(useQueueStore.getState().jobs[0].output_format).toBe('mp3');
  });

  it('setBitrate updates bitrate for the matching job', () => {
    useQueueStore.getState().setJobs([makeJob({ id: 'job-1', bitrate: '' })]);
    useQueueStore.getState().setBitrate('job-1', '192k');
    expect(useQueueStore.getState().jobs[0].bitrate).toBe('192k');
  });

  it('setOutputFilepath updates output_filepath for the matching job', () => {
    useQueueStore.getState().setJobs([makeJob({ id: 'job-1' })]);
    useQueueStore.getState().setOutputFilepath('job-1', '/tmp/out.wav');
    expect(useQueueStore.getState().jobs[0].output_filepath).toBe('/tmp/out.wav');
  });

  it('setSelectedJob sets exclusive selection', () => {
    useQueueStore.getState().setSelectedJob('abc');
    expect(useQueueStore.getState().selectedJobIds).toEqual(['abc']);
    useQueueStore.getState().setSelectedJob(null);
    expect(useQueueStore.getState().selectedJobIds).toEqual([]);
  });

  it('toggleSelectJob adds and removes individual ids', () => {
    useQueueStore.getState().toggleSelectJob('a');
    expect(useQueueStore.getState().selectedJobIds).toContain('a');
    useQueueStore.getState().toggleSelectJob('a');
    expect(useQueueStore.getState().selectedJobIds).not.toContain('a');
  });

  it('selectAllJobs selects every job id', () => {
    useQueueStore.setState({ jobs: [makeJob({ id: '1' }), makeJob({ id: '2' }), makeJob({ id: '3' })] });
    useQueueStore.getState().selectAllJobs();
    expect(useQueueStore.getState().selectedJobIds).toHaveLength(3);
  });

  it('clearSelection empties selectedJobIds', () => {
    useQueueStore.setState({ selectedJobIds: ['a', 'b'] });
    useQueueStore.getState().clearSelection();
    expect(useQueueStore.getState().selectedJobIds).toHaveLength(0);
  });

  it('primarySelectedId returns first selected id or null', () => {
    useQueueStore.setState({ selectedJobIds: ['x', 'y'] });
    expect(useQueueStore.getState().primarySelectedId()).toBe('x');
    useQueueStore.setState({ selectedJobIds: [] });
    expect(useQueueStore.getState().primarySelectedId()).toBeNull();
  });

  it('rangeSelectJobs selects a contiguous range', () => {
    useQueueStore.setState({
      jobs: [
        makeJob({ id: 'a' }), makeJob({ id: 'b' }),
        makeJob({ id: 'c' }), makeJob({ id: 'd' }),
      ],
      selectedJobIds: ['a'],
    });
    useQueueStore.getState().rangeSelectJobs('c');
    const ids = useQueueStore.getState().selectedJobIds;
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
  });

  it('setViewMode toggles between table and grid', () => {
    expect(useQueueStore.getState().viewMode).toBe('table');
    useQueueStore.getState().setViewMode('grid');
    expect(useQueueStore.getState().viewMode).toBe('grid');
  });

  it('reorderJobs moves a job from one position to another', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: 'a' }), makeJob({ id: 'b' }), makeJob({ id: 'c' })],
    });
    useQueueStore.getState().reorderJobs('a', 'c');
    const ids = useQueueStore.getState().jobs.map((j) => j.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('reorderJobs is a no-op when active and over are the same', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: 'a' }), makeJob({ id: 'b' })],
    });
    useQueueStore.getState().reorderJobs('a', 'a');
    const ids = useQueueStore.getState().jobs.map((j) => j.id);
    expect(ids).toEqual(['a', 'b']);
  });
});
