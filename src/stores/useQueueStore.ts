import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueueJob, JobStatus } from '@/types/queue';
import type { AudioSubTab } from '@/stores/useUIStore';
import { useUIStore } from '@/stores/useUIStore';

export type ViewMode = 'table' | 'grid';

export interface JobGroup { label: string; jobs: QueueJob[]; }

const ALL_TABS: AudioSubTab[] = ['enhance', 'convert'];

function emptyPerTab<T>(factory: () => T): Record<AudioSubTab, T> {
  return { enhance: factory(), convert: factory() };
}

function getActiveSubTab(tab?: AudioSubTab): AudioSubTab {
  return tab ?? useUIStore.getState().audioSubTab;
}

// Update a job by ID searching across all tab queues
function updateJobById(
  tabQueues: Record<AudioSubTab, QueueJob[]>,
  id: string,
  updater: (j: QueueJob) => QueueJob,
): Record<AudioSubTab, QueueJob[]> {
  for (const tab of ALL_TABS) {
    const idx = tabQueues[tab].findIndex((j) => j.id === id);
    if (idx !== -1) {
      const arr = [...tabQueues[tab]];
      arr[idx] = updater(arr[idx]);
      return { ...tabQueues, [tab]: arr };
    }
  }
  return tabQueues;
}

// Update a job field in all tab queues matching the id
function patchJobById<K extends keyof QueueJob>(
  tabQueues: Record<AudioSubTab, QueueJob[]>,
  id: string,
  patch: Pick<QueueJob, K>,
): Record<AudioSubTab, QueueJob[]> {
  return updateJobById(tabQueues, id, (j) => ({ ...j, ...patch }));
}

interface QueueState {
  // ── Per-tab queues ─────────────────────────────────────────────────────────
  tabQueues: Record<AudioSubTab, QueueJob[]>;
  tabFilters: Record<AudioSubTab, string>;
  tabSearches: Record<AudioSubTab, string>;
  tabSelectedIds: Record<AudioSubTab, string[]>;
  tabLockedIds: Record<AudioSubTab, string[]>;
  tabImportingIds: Record<AudioSubTab, string[]>;
  tabViewModes: Record<AudioSubTab, ViewMode>;
  tabGroupByFormat: Record<AudioSubTab, boolean>;
  tabJobOpTypes: Record<AudioSubTab, Record<string, 'enhance' | 'convert'>>;

  // ── Helpers ────────────────────────────────────────────────────────────────
  findJobTab: (id: string) => AudioSubTab | null;
  getJobById: (id: string) => QueueJob | undefined;

  // ── Job add/set ────────────────────────────────────────────────────────────
  setJobs: (jobs: QueueJob[], tab?: AudioSubTab) => void;
  addJobs: (jobs: QueueJob[], tab?: AudioSubTab) => void;

  // ── Background import placeholders ─────────────────────────────────────────
  // Rows that appear immediately (dimmed / non-interactive) while their audio is
  // extracted or verified in the background, then get swapped for the real job.
  addPlaceholders: (jobs: QueueJob[], tab?: AudioSubTab) => void;
  resolvePlaceholder: (tempId: string, realJob: QueueJob, tab?: AudioSubTab) => void;
  removePlaceholder: (tempId: string, tab?: AudioSubTab) => void;

  // ── Job mutations (search all tabs by ID) ──────────────────────────────────
  setProgress: (id: string, percent: number) => void;
  setStatus: (id: string, status: JobStatus, errorMessage?: string) => void;
  setOutputFormat: (id: string, format: string) => void;
  setBitrate: (id: string, bitrate: string) => void;
  setOutputFilepath: (id: string, filepath: string) => void;
  setAbMode: (id: string, mode: 'enhanced' | 'original') => void;
  setSampleRate: (id: string, rate: string) => void;
  setDestination: (id: string, dest: string) => void;
  setDestinationBatch: (ids: string[], dest: string) => void;
  setDownloadPath: (id: string, path: string) => void;

  // ── Per-tab UI state ───────────────────────────────────────────────────────
  setFilter: (filter: string, tab?: AudioSubTab) => void;
  setSearchQuery: (query: string, tab?: AudioSubTab) => void;
  clearQueue: (tab?: AudioSubTab) => void;
  setViewMode: (mode: ViewMode, tab?: AudioSubTab) => void;
  setGroupByFormat: (v: boolean, tab?: AudioSubTab) => void;
  setJobOperationMode: (id: string, mode: 'enhance' | 'convert', tab?: AudioSubTab) => void;

  // ── Selection (scoped to active/specified tab) ─────────────────────────────
  setSelectedJob: (id: string | null, tab?: AudioSubTab) => void;
  toggleSelectJob: (id: string, tab?: AudioSubTab) => void;
  rangeSelectJobs: (targetId: string, tab?: AudioSubTab) => void;
  selectAllJobs: (tab?: AudioSubTab) => void;
  clearSelection: (tab?: AudioSubTab) => void;
  primarySelectedId: (tab?: AudioSubTab) => string | null;

  // ── Lock ───────────────────────────────────────────────────────────────────
  lockJobs: (ids: string[], tab?: AudioSubTab) => void;
  unlockJobs: (ids: string[], tab?: AudioSubTab) => void;
  lockAllJobs: (tab?: AudioSubTab) => void;
  unlockAllJobs: (tab?: AudioSubTab) => void;

  // ── Reorder ────────────────────────────────────────────────────────────────
  reorderJobs: (activeId: string, overId: string, tab?: AudioSubTab) => void;

  // ── Delete ─────────────────────────────────────────────────────────────────
  deleteJobs: (ids: string[], tab?: AudioSubTab) => void;

  // ── Filtered views ─────────────────────────────────────────────────────────
  filteredJobs: (subTab: AudioSubTab, mediaTab?: 'audio' | 'video') => QueueJob[];
  groupedFilteredJobs: (subTab: AudioSubTab, mediaTab?: 'audio' | 'video') => JobGroup[];
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      tabQueues: emptyPerTab(() => [] as QueueJob[]),
      tabFilters: emptyPerTab(() => 'all'),
      tabSearches: emptyPerTab(() => ''),
      tabSelectedIds: emptyPerTab(() => [] as string[]),
      tabLockedIds: emptyPerTab(() => [] as string[]),
      tabImportingIds: emptyPerTab(() => [] as string[]),
      tabViewModes: emptyPerTab(() => 'table' as ViewMode),
      tabGroupByFormat: emptyPerTab(() => false),
      tabJobOpTypes: emptyPerTab(() => ({} as Record<string, 'enhance' | 'convert'>)),

      // ── Helpers ──────────────────────────────────────────────────────────────
      findJobTab: (id) => {
        const { tabQueues } = get();
        for (const tab of ALL_TABS) {
          if (tabQueues[tab].some((j) => j.id === id)) return tab;
        }
        return null;
      },

      getJobById: (id) => {
        const { tabQueues } = get();
        for (const tab of ALL_TABS) {
          const j = tabQueues[tab].find((j) => j.id === id);
          if (j) return j;
        }
        return undefined;
      },

      // ── Job add/set ──────────────────────────────────────────────────────────
      setJobs: (jobs, tab) =>
        set((s) => {
          if (tab !== undefined) {
            return { tabQueues: { ...s.tabQueues, [tab]: jobs } };
          }
          const updatedQueues = {
            enhance: [...s.tabQueues.enhance],
            convert: [...s.tabQueues.convert],
          };
          const matchedIds = new Set<string>();
          for (const dbJob of jobs) {
            for (const t of ALL_TABS) {
              const idx = updatedQueues[t].findIndex((j) => j.id === dbJob.id);
              if (idx !== -1) {
                const existing = updatedQueues[t][idx];
                updatedQueues[t][idx] = {
                  ...existing,
                  ...dbJob,
                  startedAt: existing.startedAt ?? dbJob.startedAt,
                  completed_duration: dbJob.completed_duration ?? existing.completed_duration,
                  ab_mode: dbJob.ab_mode ?? existing.ab_mode ?? 'original',
                };
                matchedIds.add(dbJob.id);
                break;
              }
            }
          }
          const unmatchedJobs = jobs.filter((j) => !matchedIds.has(j.id));
          if (unmatchedJobs.length > 0) {
            const activeTab = getActiveSubTab();
            updatedQueues[activeTab] = [...updatedQueues[activeTab], ...unmatchedJobs];
          }
          const dbJobIds = new Set(jobs.map((j) => j.id));
          for (const t of ALL_TABS) {
            updatedQueues[t] = updatedQueues[t].filter((j) => dbJobIds.has(j.id));
          }
          return { tabQueues: updatedQueues };
        }),

      addJobs: (newJobs, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          const existing = new Set(s.tabQueues[t].map((j) => j.id));
          const unique = newJobs.filter((j) => !existing.has(j.id));
          if (!unique.length) return s;
          const newIds = unique.map((j) => j.id);
          setTimeout(() => {
            useQueueStore.setState((prev) => ({
              tabImportingIds: {
                ...prev.tabImportingIds,
                [t]: prev.tabImportingIds[t].filter((id) => !newIds.includes(id)),
              },
            }));
          }, 1500);
          return {
            tabQueues: { ...s.tabQueues, [t]: [...s.tabQueues[t], ...unique] },
            tabImportingIds: {
              ...s.tabImportingIds,
              [t]: [...new Set([...s.tabImportingIds[t], ...newIds])],
            },
          };
        }),

      // ── Background import placeholders ─────────────────────────────────────
      addPlaceholders: (jobs, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          const ids = jobs.map((j) => j.id);
          return {
            tabQueues: { ...s.tabQueues, [t]: [...s.tabQueues[t], ...jobs] },
            tabImportingIds: {
              ...s.tabImportingIds,
              [t]: [...new Set([...s.tabImportingIds[t], ...ids])],
            },
          };
        }),

      resolvePlaceholder: (tempId, realJob, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabQueues: {
              ...s.tabQueues,
              [t]: s.tabQueues[t].map((j) => (j.id === tempId ? realJob : j)),
            },
            // Illuminate the swapped-in real row immediately.
            tabImportingIds: {
              ...s.tabImportingIds,
              [t]: s.tabImportingIds[t].filter((id) => id !== tempId && id !== realJob.id),
            },
          };
        }),

      removePlaceholder: (tempId, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabQueues: { ...s.tabQueues, [t]: s.tabQueues[t].filter((j) => j.id !== tempId) },
            tabImportingIds: {
              ...s.tabImportingIds,
              [t]: s.tabImportingIds[t].filter((id) => id !== tempId),
            },
            tabSelectedIds: {
              ...s.tabSelectedIds,
              [t]: s.tabSelectedIds[t].filter((id) => id !== tempId),
            },
          };
        }),

      // ── Job mutations ────────────────────────────────────────────────────────
      setProgress: (id, percent) =>
        set((s) => ({
          tabQueues: updateJobById(s.tabQueues, id, (j) => ({ ...j, progress: percent })),
        })),

      setStatus: (id, status, errorMessage) =>
        set((s) => ({
          tabQueues: updateJobById(s.tabQueues, id, (j) => {
            let completed_duration = j.completed_duration;
            if (status === 'done' && j.status === 'processing' && j.startedAt) {
              completed_duration = Math.floor((Date.now() - j.startedAt) / 1000);
            } else if (status === 'processing') {
              completed_duration = undefined;
            }
            const newStartedAt =
              status === 'processing' && j.status !== 'processing'
                ? Date.now()
                : status === 'done' || status === 'error' || status === 'pending'
                ? undefined
                : j.startedAt;
            return {
              ...j,
              status,
              error_message: errorMessage ?? j.error_message,
              startedAt: newStartedAt,
              completed_duration,
            };
          }),
        })),

      setOutputFormat: (id, format) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { output_format: format }) })),

      setBitrate: (id, bitrate) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { bitrate }) })),

      setOutputFilepath: (id, filepath) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { output_filepath: filepath }) })),

      setAbMode: (id, mode) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { ab_mode: mode }) })),

      setSampleRate: (id, rate) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { sample_rate: rate }) })),

      setDestination: (id, dest) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { destination: dest }) })),

      setDestinationBatch: (ids, dest) =>
        set((s) => {
          let tq = s.tabQueues;
          for (const id of ids) {
            tq = patchJobById(tq, id, { destination: dest });
          }
          return { tabQueues: tq };
        }),

      setDownloadPath: (id, path) =>
        set((s) => ({ tabQueues: patchJobById(s.tabQueues, id, { download_path: path }) })),

      // ── Per-tab UI state ─────────────────────────────────────────────────────
      setFilter: (filter, tab) =>
        set((s) => ({ tabFilters: { ...s.tabFilters, [getActiveSubTab(tab)]: filter } })),

      setSearchQuery: (query, tab) =>
        set((s) => ({ tabSearches: { ...s.tabSearches, [getActiveSubTab(tab)]: query } })),

      clearQueue: (tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          const locked = s.tabLockedIds[t];
          return {
            tabQueues: { ...s.tabQueues, [t]: s.tabQueues[t].filter((j) => locked.includes(j.id)) },
            tabSelectedIds: {
              ...s.tabSelectedIds,
              [t]: s.tabSelectedIds[t].filter((id) => locked.includes(id)),
            },
            tabImportingIds: { ...s.tabImportingIds, [t]: [] },
          };
        }),

      setViewMode: (mode, tab) =>
        set((s) => ({ tabViewModes: { ...s.tabViewModes, [getActiveSubTab(tab)]: mode } })),

      setGroupByFormat: (v, tab) =>
        set((s) => ({ tabGroupByFormat: { ...s.tabGroupByFormat, [getActiveSubTab(tab)]: v } })),

      setJobOperationMode: (id, mode, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabJobOpTypes: {
              ...s.tabJobOpTypes,
              [t]: { ...s.tabJobOpTypes[t], [id]: mode },
            },
          };
        }),

      // ── Selection ────────────────────────────────────────────────────────────
      setSelectedJob: (id, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return { tabSelectedIds: { ...s.tabSelectedIds, [t]: id ? [id] : [] } };
        }),

      toggleSelectJob: (id, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          const cur = s.tabSelectedIds[t];
          return {
            tabSelectedIds: {
              ...s.tabSelectedIds,
              [t]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
            },
          };
        }),

      rangeSelectJobs: (targetId, tab) => {
        const t = getActiveSubTab(tab);
        const { tabQueues, tabSelectedIds } = get();
        const jobs = tabQueues[t];
        const selectedIds = tabSelectedIds[t];
        const anchor = selectedIds[selectedIds.length - 1];
        if (!anchor) {
          set((s) => ({ tabSelectedIds: { ...s.tabSelectedIds, [t]: [targetId] } }));
          return;
        }
        const ids = jobs.map((j) => j.id);
        const aIdx = ids.indexOf(anchor);
        const tIdx = ids.indexOf(targetId);
        if (aIdx === -1 || tIdx === -1) {
          set((s) => ({ tabSelectedIds: { ...s.tabSelectedIds, [t]: [targetId] } }));
          return;
        }
        const [lo, hi] = aIdx < tIdx ? [aIdx, tIdx] : [tIdx, aIdx];
        const rangeIds = ids.slice(lo, hi + 1);
        const merged = [...new Set([...selectedIds, ...rangeIds])];
        set((s) => ({ tabSelectedIds: { ...s.tabSelectedIds, [t]: merged } }));
      },

      selectAllJobs: (tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabSelectedIds: {
              ...s.tabSelectedIds,
              [t]: s.tabQueues[t].map((j) => j.id),
            },
          };
        }),

      clearSelection: (tab) =>
        set((s) => ({ tabSelectedIds: { ...s.tabSelectedIds, [getActiveSubTab(tab)]: [] } })),

      primarySelectedId: (tab) => {
        const t = getActiveSubTab(tab);
        return get().tabSelectedIds[t][0] ?? null;
      },

      // ── Lock ─────────────────────────────────────────────────────────────────
      lockJobs: (ids, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabLockedIds: {
              ...s.tabLockedIds,
              [t]: [...new Set([...s.tabLockedIds[t], ...ids])],
            },
          };
        }),

      unlockJobs: (ids, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabLockedIds: {
              ...s.tabLockedIds,
              [t]: s.tabLockedIds[t].filter((id) => !ids.includes(id)),
            },
          };
        }),

      lockAllJobs: (tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabLockedIds: {
              ...s.tabLockedIds,
              [t]: s.tabQueues[t].map((j) => j.id),
            },
          };
        }),

      unlockAllJobs: (tab) =>
        set((s) => ({ tabLockedIds: { ...s.tabLockedIds, [getActiveSubTab(tab)]: [] } })),

      // ── Reorder ──────────────────────────────────────────────────────────────
      reorderJobs: (activeId, overId, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          const jobs = s.tabQueues[t];
          const selected = s.tabSelectedIds[t];
          const isMulti = selected.includes(activeId) && selected.length > 1;

          if (!isMulti) {
            const oldIndex = jobs.findIndex((j) => j.id === activeId);
            const newIndex = jobs.findIndex((j) => j.id === overId);
            if (oldIndex === -1 || newIndex === -1) return s;
            const newJobs = [...jobs];
            const [item] = newJobs.splice(oldIndex, 1);
            newJobs.splice(newIndex, 0, item);
            return { tabQueues: { ...s.tabQueues, [t]: newJobs } };
          }

          const movingJobs = jobs.filter((j) => selected.includes(j.id));
          const remainingJobs = jobs.filter((j) => !selected.includes(j.id));

          let targetIdx = remainingJobs.findIndex((j) => j.id === overId);
          if (targetIdx === -1) {
            const overOrigIdx = jobs.findIndex((j) => j.id === overId);
            targetIdx = remainingJobs.filter(
              (j) => jobs.findIndex((jj) => jj.id === j.id) < overOrigIdx,
            ).length;
          }

          const oldActiveIdx = jobs.findIndex((j) => j.id === activeId);
          const oldOverIdx = jobs.findIndex((j) => j.id === overId);
          if (oldActiveIdx <= oldOverIdx) targetIdx += 1;

          const newJobs = [...remainingJobs];
          newJobs.splice(targetIdx, 0, ...movingJobs);
          return { tabQueues: { ...s.tabQueues, [t]: newJobs } };
        }),

      // ── Delete ───────────────────────────────────────────────────────────────
      deleteJobs: (ids, tab) =>
        set((s) => {
          const t = getActiveSubTab(tab);
          return {
            tabQueues: { ...s.tabQueues, [t]: s.tabQueues[t].filter((j) => !ids.includes(j.id)) },
            tabSelectedIds: {
              ...s.tabSelectedIds,
              [t]: s.tabSelectedIds[t].filter((id) => !ids.includes(id)),
            },
            tabLockedIds: {
              ...s.tabLockedIds,
              [t]: s.tabLockedIds[t].filter((id) => !ids.includes(id)),
            },
          };
        }),

      // ── Filtered views ───────────────────────────────────────────────────────
      filteredJobs: (subTab, mediaTab) => {
        const { tabQueues, tabFilters, tabSearches } = get();
        const jobs = tabQueues[subTab];
        const filter = tabFilters[subTab];
        const search = tabSearches[subTab];
        return jobs
          .filter((j) => filter === 'all' || j.status === filter)
          .filter((j) => !search || j.filename.toLowerCase().includes(search.toLowerCase()))
          .filter((j) => !mediaTab || j.media_type === mediaTab);
      },

      groupedFilteredJobs: (subTab, mediaTab) => {
        const filtered = get().filteredJobs(subTab, mediaTab);
        const map = new Map<string, QueueJob[]>();
        for (const job of filtered) {
          const ext = job.filename.includes('.')
            ? job.filename.split('.').pop()!.toUpperCase()
            : 'UNKNOWN';
          if (!map.has(ext)) map.set(ext, []);
          map.get(ext)!.push(job);
        }
        return Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, jobs]) => ({ label, jobs }));
      },
    }),
    {
      name: 'queue-ui-prefs-v2',
      partialize: (state) => ({
        tabQueues: state.tabQueues,
        tabFilters: state.tabFilters,
        tabViewModes: state.tabViewModes,
        tabGroupByFormat: state.tabGroupByFormat,
        tabLockedIds: state.tabLockedIds,
      }),
    },
  ),
);
