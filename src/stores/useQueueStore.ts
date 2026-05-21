import { create } from 'zustand';
import type { QueueJob, JobStatus } from '@/types/queue';

interface QueueState {
  jobs: QueueJob[];
  filter: string;
  searchQuery: string;
  setJobs: (jobs: QueueJob[]) => void;
  addJobs: (jobs: QueueJob[]) => void;
  setFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  clearQueue: () => void;
  filteredJobs: () => QueueJob[];
  setProgress: (id: string, percent: number) => void;
  setStatus: (id: string, status: JobStatus, errorMessage?: string) => void;
  setOutputFormat: (id: string, format: string) => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  filter: 'all',
  searchQuery: '',
  setJobs: (jobs) => set({ jobs }),
  addJobs: (newJobs) => set((s) => ({ jobs: [...s.jobs, ...newJobs] })),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearQueue: () => set({ jobs: [] }),
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
}));
