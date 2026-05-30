import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueueJob, JobStatus } from '@/types/queue';

export type ViewMode = 'table' | 'grid';

export interface JobGroup { label: string; jobs: QueueJob[]; }

interface QueueState {
  jobs: QueueJob[];
  filter: string;
  searchQuery: string;
  selectedJobIds: string[];
  lockedJobIds: string[];
  viewMode: ViewMode;
  groupByFormat: boolean;
  setJobs: (jobs: QueueJob[]) => void;
  addJobs: (jobs: QueueJob[]) => void;
  setFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  clearQueue: () => void;
  filteredJobs: () => QueueJob[];
  groupedFilteredJobs: () => JobGroup[];
  setProgress: (id: string, percent: number) => void;
  setStatus: (id: string, status: JobStatus, errorMessage?: string) => void;
  setOutputFormat: (id: string, format: string) => void;
  setBitrate: (id: string, bitrate: string) => void;
  setOutputFilepath: (id: string, filepath: string) => void;
  setAbMode: (id: string, mode: 'enhanced' | 'original') => void;
  // Selection
  setSelectedJob: (id: string | null) => void;
  toggleSelectJob: (id: string) => void;
  rangeSelectJobs: (targetId: string) => void;
  selectAllJobs: () => void;
  clearSelection: () => void;
  primarySelectedId: () => string | null;
  setSampleRate: (id: string, rate: string) => void;
  // Lock
  lockJobs: (ids: string[]) => void;
  unlockJobs: (ids: string[]) => void;
  lockAllJobs: () => void;
  unlockAllJobs: () => void;
  // Reorder
  reorderJobs: (activeId: string, overId: string) => void;
  // View
  setViewMode: (mode: ViewMode) => void;
  setGroupByFormat: (v: boolean) => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
  jobs: [],
  filter: 'all',
  searchQuery: '',
  selectedJobIds: [],
  lockedJobIds: [],
  viewMode: 'table',
  groupByFormat: false,

  setJobs: (jobs) => set({ jobs }),
  addJobs: (newJobs) => set((s) => {
    const existing = new Set(s.jobs.map((j) => j.id));
    const unique = newJobs.filter((j) => !existing.has(j.id));
    return unique.length ? { jobs: [...s.jobs, ...unique] } : s;
  }),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearQueue: () => set({ jobs: [], selectedJobIds: [] }),

  filteredJobs: () => {
    const { jobs, filter, searchQuery } = get();
    return jobs
      .filter((j) => filter === 'all' || j.status === filter)
      .filter((j) => !searchQuery || j.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  },

  groupedFilteredJobs: () => {
    const filtered = get().filteredJobs();
    const map = new Map<string, QueueJob[]>();
    for (const job of filtered) {
      const ext = job.filename.includes('.') ? job.filename.split('.').pop()!.toUpperCase() : 'UNKNOWN';
      if (!map.has(ext)) map.set(ext, []);
      map.get(ext)!.push(job);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, jobs]) => ({ label, jobs }));
  },

  setProgress: (id, percent) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, progress: percent } : j)),
    })),

  setStatus: (id, status, errorMessage) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, status, error_message: errorMessage ?? j.error_message } : j
      ),
    })),

  setOutputFormat: (id, format) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, output_format: format } : j)),
    })),

  setBitrate: (id, bitrate) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, bitrate } : j)),
    })),

  setOutputFilepath: (id, filepath) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, output_filepath: filepath } : j)),
    })),

  setAbMode: (id, mode) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ab_mode: mode } : j)),
    })),

  // Exclusive single select (backward-compat for row click without modifier)
  setSelectedJob: (id) =>
    set({ selectedJobIds: id ? [id] : [] }),

  toggleSelectJob: (id) =>
    set((s) => ({
      selectedJobIds: s.selectedJobIds.includes(id)
        ? s.selectedJobIds.filter((x) => x !== id)
        : [...s.selectedJobIds, id],
    })),

  rangeSelectJobs: (targetId) => {
    const { jobs, selectedJobIds } = get();
    const anchor = selectedJobIds[selectedJobIds.length - 1];
    if (!anchor) {
      set({ selectedJobIds: [targetId] });
      return;
    }
    const ids = jobs.map((j) => j.id);
    const aIdx = ids.indexOf(anchor);
    const tIdx = ids.indexOf(targetId);
    if (aIdx === -1 || tIdx === -1) {
      set({ selectedJobIds: [targetId] });
      return;
    }
    const [lo, hi] = aIdx < tIdx ? [aIdx, tIdx] : [tIdx, aIdx];
    const rangeIds = ids.slice(lo, hi + 1);
    const merged = [...new Set([...selectedJobIds, ...rangeIds])];
    set({ selectedJobIds: merged });
  },

  selectAllJobs: () => set((s) => ({ selectedJobIds: s.jobs.map((j) => j.id) })),

  clearSelection: () => set({ selectedJobIds: [] }),

  primarySelectedId: () => {
    const { selectedJobIds } = get();
    return selectedJobIds[0] ?? null;
  },

  setSampleRate: (id, rate) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, sample_rate: rate } : j)),
    })),

  lockJobs: (ids) =>
    set((s) => ({ lockedJobIds: [...new Set([...s.lockedJobIds, ...ids])] })),

  unlockJobs: (ids) =>
    set((s) => ({ lockedJobIds: s.lockedJobIds.filter((id) => !ids.includes(id)) })),

  lockAllJobs: () =>
    set((s) => ({ lockedJobIds: s.jobs.map((j) => j.id) })),

  unlockAllJobs: () => set({ lockedJobIds: [] }),

  reorderJobs: (activeId, overId) =>
    set((s) => {
      const oldIndex = s.jobs.findIndex((j) => j.id === activeId);
      const newIndex = s.jobs.findIndex((j) => j.id === overId);
      if (oldIndex === -1 || newIndex === -1) return s;
      const newJobs = [...s.jobs];
      const [item] = newJobs.splice(oldIndex, 1);
      newJobs.splice(newIndex, 0, item);
      return { jobs: newJobs };
    }),

  setViewMode: (viewMode) => set({ viewMode }),

  setGroupByFormat: (groupByFormat) => set({ groupByFormat }),
    }),
    {
      name: 'queue-ui-prefs',
      partialize: (state) => ({ filter: state.filter, viewMode: state.viewMode, groupByFormat: state.groupByFormat }),
    }
  )
);
