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
  download_path: null,
  sample_rate: '',
  created_at: '2026-05-20T00:00:00Z',
  updated_at: '2026-05-20T00:00:00Z',
  ...overrides,
});

// Helper to get the 'enhance' tab jobs (default active tab in tests)
const TAB = 'enhance' as const;
const getTabJobs = () => useQueueStore.getState().tabQueues[TAB];
const getSelectedIds = () => useQueueStore.getState().tabSelectedIds[TAB];

describe('useQueueStore', () => {
  beforeEach(() => {
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
  });

  it('adds jobs', () => {
    useQueueStore.getState().addJobs([makeJob()], TAB);
    expect(getTabJobs()).toHaveLength(1);
  });

  it('filters by status', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: '1', status: 'pending' }), makeJob({ id: '2', status: 'done' })], convert: [] },
      tabFilters: { enhance: 'done', convert: 'all' },
    });
    const results = useQueueStore.getState().filteredJobs(TAB);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('done');
  });

  it('filters by search query', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: '1', filename: 'podcast.mp3' }), makeJob({ id: '2', filename: 'music.wav' })], convert: [] },
      tabSearches: { enhance: 'podcast', convert: '' },
    });
    expect(useQueueStore.getState().filteredJobs(TAB)).toHaveLength(1);
  });

  it('clears queue', () => {
    useQueueStore.setState({ tabQueues: { enhance: [makeJob()], convert: [] } });
    useQueueStore.getState().clearQueue(TAB);
    expect(getTabJobs()).toHaveLength(0);
  });

  it('setProgress updates progress on the matching job only', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: 'a', progress: 0 }), makeJob({ id: 'b', progress: 0 })], convert: [] },
    });
    useQueueStore.getState().setProgress('a', 50);
    const jobs = getTabJobs();
    expect(jobs.find((j) => j.id === 'a')?.progress).toBe(50);
    expect(jobs.find((j) => j.id === 'b')?.progress).toBe(0);
  });

  it('setStatus updates status and keeps error_message null when not provided', () => {
    useQueueStore.setState({ tabQueues: { enhance: [makeJob({ id: 'x', status: 'pending' })], convert: [] } });
    useQueueStore.getState().setStatus('x', 'processing');
    const job = getTabJobs()[0];
    expect(job.status).toBe('processing');
    expect(job.error_message).toBeNull();
  });

  it('setStatus records error_message when status is error', () => {
    useQueueStore.setState({ tabQueues: { enhance: [makeJob({ id: 'y', status: 'processing' })], convert: [] } });
    useQueueStore.getState().setStatus('y', 'error', 'Model not found');
    const job = getTabJobs()[0];
    expect(job.status).toBe('error');
    expect(job.error_message).toBe('Model not found');
  });

  it('setOutputFormat updates output_format for the matching job', () => {
    useQueueStore.getState().setJobs([makeJob({ id: 'job-1', output_format: 'wav' })], TAB);
    useQueueStore.getState().setOutputFormat('job-1', 'mp3');
    expect(getTabJobs()[0].output_format).toBe('mp3');
  });

  it('setBitrate updates bitrate for the matching job', () => {
    useQueueStore.getState().setJobs([makeJob({ id: 'job-1', bitrate: '' })], TAB);
    useQueueStore.getState().setBitrate('job-1', '192k');
    expect(getTabJobs()[0].bitrate).toBe('192k');
  });

  it('setOutputFilepath updates output_filepath for the matching job', () => {
    useQueueStore.getState().setJobs([makeJob({ id: 'job-1' })], TAB);
    useQueueStore.getState().setOutputFilepath('job-1', '/tmp/out.wav');
    expect(getTabJobs()[0].output_filepath).toBe('/tmp/out.wav');
  });

  it('setSelectedJob sets exclusive selection', () => {
    useQueueStore.getState().setSelectedJob('abc', TAB);
    expect(getSelectedIds()).toEqual(['abc']);
    useQueueStore.getState().setSelectedJob(null, TAB);
    expect(getSelectedIds()).toEqual([]);
  });

  it('toggleSelectJob adds and removes individual ids', () => {
    useQueueStore.getState().toggleSelectJob('a', TAB);
    expect(getSelectedIds()).toContain('a');
    useQueueStore.getState().toggleSelectJob('a', TAB);
    expect(getSelectedIds()).not.toContain('a');
  });

  it('selectAllJobs selects every job id', () => {
    useQueueStore.setState({ tabQueues: { enhance: [makeJob({ id: '1' }), makeJob({ id: '2' }), makeJob({ id: '3' })], convert: [] } });
    useQueueStore.getState().selectAllJobs(TAB);
    expect(getSelectedIds()).toHaveLength(3);
  });

  it('clearSelection empties selectedJobIds', () => {
    useQueueStore.setState({ tabSelectedIds: { enhance: ['a', 'b'], convert: [] } });
    useQueueStore.getState().clearSelection(TAB);
    expect(getSelectedIds()).toHaveLength(0);
  });

  it('primarySelectedId returns first selected id or null', () => {
    useQueueStore.setState({ tabSelectedIds: { enhance: ['x', 'y'], convert: [] } });
    expect(useQueueStore.getState().primarySelectedId(TAB)).toBe('x');
    useQueueStore.setState({ tabSelectedIds: { enhance: [], convert: [] } });
    expect(useQueueStore.getState().primarySelectedId(TAB)).toBeNull();
  });

  it('rangeSelectJobs selects a contiguous range', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: 'a' }), makeJob({ id: 'b' }), makeJob({ id: 'c' }), makeJob({ id: 'd' })], convert: [] },
      tabSelectedIds: { enhance: ['a'], convert: [] },
    });
    useQueueStore.getState().rangeSelectJobs('c', TAB);
    const ids = getSelectedIds();
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
  });

  it('setViewMode toggles between table and grid', () => {
    expect(useQueueStore.getState().tabViewModes[TAB]).toBe('table');
    useQueueStore.getState().setViewMode('grid', TAB);
    expect(useQueueStore.getState().tabViewModes[TAB]).toBe('grid');
  });

  it('reorderJobs moves a job from one position to another', () => {
    useQueueStore.setState({ tabQueues: { enhance: [makeJob({ id: 'a' }), makeJob({ id: 'b' }), makeJob({ id: 'c' })], convert: [] } });
    useQueueStore.getState().reorderJobs('a', 'c', TAB);
    const ids = getTabJobs().map((j) => j.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('reorderJobs is a no-op when active and over are the same', () => {
    useQueueStore.setState({ tabQueues: { enhance: [makeJob({ id: 'a' }), makeJob({ id: 'b' })], convert: [] } });
    useQueueStore.getState().reorderJobs('a', 'a', TAB);
    const ids = getTabJobs().map((j) => j.id);
    expect(ids).toEqual(['a', 'b']);
  });

  it('setGroupByFormat toggles groupByFormat', () => {
    expect(useQueueStore.getState().tabGroupByFormat[TAB]).toBe(false);
    useQueueStore.getState().setGroupByFormat(true, TAB);
    expect(useQueueStore.getState().tabGroupByFormat[TAB]).toBe(true);
  });

  it('groupedFilteredJobs groups jobs by input file extension', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: '1', filename: 'a.mp3' }), makeJob({ id: '2', filename: 'b.mp3' }), makeJob({ id: '3', filename: 'c.wav' })], convert: [] },
      tabFilters: { enhance: 'all', convert: 'all' },
      tabSearches: { enhance: '', convert: '' },
    });
    const groups = useQueueStore.getState().groupedFilteredJobs(TAB);
    expect(groups).toHaveLength(2);
    const mp3Group = groups.find((g) => g.label === 'MP3');
    expect(mp3Group?.jobs).toHaveLength(2);
    const wavGroup = groups.find((g) => g.label === 'WAV');
    expect(wavGroup?.jobs).toHaveLength(1);
  });

  it('groupedFilteredJobs sorts groups alphabetically', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: '1', filename: 'z.wav' }), makeJob({ id: '2', filename: 'a.mp3' })], convert: [] },
      tabFilters: { enhance: 'all', convert: 'all' },
      tabSearches: { enhance: '', convert: '' },
    });
    const groups = useQueueStore.getState().groupedFilteredJobs(TAB);
    expect(groups[0].label).toBe('MP3');
    expect(groups[1].label).toBe('WAV');
  });

  it('insertJobAtTop places a new job at index 0 without duplicating an existing job', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: 'a' }), makeJob({ id: 'b' })], convert: [] },
    });
    useQueueStore.getState().insertJobAtTop(makeJob({ id: 'new' }), TAB);
    const ids = getTabJobs().map((j) => j.id);
    expect(ids).toEqual(['new', 'a', 'b']);
  });

  it('insertJobAtTop is a no-op if the job id already exists in the tab', () => {
    useQueueStore.setState({
      tabQueues: { enhance: [makeJob({ id: 'a' }), makeJob({ id: 'b' })], convert: [] },
    });
    useQueueStore.getState().insertJobAtTop(makeJob({ id: 'a' }), TAB);
    expect(getTabJobs()).toHaveLength(2);
    expect(getTabJobs()[0].id).toBe('a');
  });
});
