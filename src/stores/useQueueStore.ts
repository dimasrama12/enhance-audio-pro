import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueueJob, JobStatus } from '@/types/queue';

export type ViewMode = 'table' | 'grid';

interface QueueState {
  jobs: QueueJob[];
  filter: string;
  searchQuery: string;
  selectedJobIds: string[];
  viewMode: ViewMode;
  setJobs: (jobs: QueueJob[]) => void;
  addJobs: (jobs: QueueJob[]) => void;
  setFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  clearQueue: () => void;
  filteredJobs: () => QueueJob[];
  setProgress: (id: string, percent: number) => void;
  setStatus: (id: string, status: JobStatus, errorMessage?: string) => void;
  setOutputFormat: (id: string, format: string) => void;
  setBitrate: (id: string, bitrate: string) => void;
  setOutputFilepath: (id: string, filepath: string) => void;
  // Selection
  setSelectedJob: (id: string | null) => void;
  toggleSelectJob: (id: string) => void;
  rangeSelectJobs: (targetId: string) => void;
  selectAllJobs: () => void;
  clearSelection: () => void;
  primarySelectedId: () => string | null;
  // Reorder
  reorderJobs: (activeId: string, overId: string) => void;
  // View
  setViewMode: (mode: ViewMode) => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
  jobs: [],
  filter: 'all',
  searchQuery: '',
  selectedJobIds: [],
  viewMode: 'table',

  setJobs: (jobs) => set({ jobs }),
  addJobs: (newJobs) => set((s) => ({ jobs: [...s.jobs, ...newJobs] })),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearQueue: () => set({ jobs: [], selectedJobIds: [] }),

  filteredJobs: () => {
    const { jobs, filter, searchQuery } = get();
    return jobs
      .filter((j) => filter === 'all' || j.status === filter)
      .filter((j) => !searchQuery || j.filename.toLowerCase().includes(searchQuery.toLowerCase()));
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
    }),
    {
      name: 'queue-ui-prefs',
      partialize: (state) => ({ filter: state.filter, viewMode: state.viewMode }),
    }
  )
);
