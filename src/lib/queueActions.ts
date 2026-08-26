import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import type { AudioSubTab } from '@/stores/useUIStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  invokeAddFiles,
  invokeProcessQueue,
  invokeConvertFiles,
  invokeCancelJobs,
  invokeSetJobStatus,
} from '@/lib/ipc';
import { logError } from '@/lib/errorLogger';
import { createLogger } from '@/lib/logger';
import type { QueueJob, EnhanceRun } from '@/types/queue';

const log = createLogger('QueueActions');

export async function triggerEnhanceAll(): Promise<void> {
  const tab = useUIStore.getState().audioSubTab;
  const { tabQueues, tabImportingIds, setStatus, addEnhanceRun } = useQueueStore.getState();
  const { enhancementStrength, hfDeHissDb } = useSettingsStore.getState();
  const importingIds = new Set(tabImportingIds[tab]);
  const enhIds = tabQueues[tab]
    .filter((j) => (j.status === 'pending' || j.status === 'error') && !importingIds.has(j.id))
    .map((j) => j.id);
  if (!enhIds.length) return;

  // Snapshot this batch as a run record (P1-A)
  const run: EnhanceRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    strength: enhancementStrength,
    hfDeHissDb: hfDeHissDb ?? -4,
    timestamp: Date.now(),
    jobIds: [...enhIds],
  };
  addEnhanceRun(run);

  log.info(`Enhance All: queuing ${enhIds.length} job(s) [run ${run.id}]`);
  enhIds.forEach((id) => setStatus(id, 'queued'));
  await Promise.all(enhIds.map((id) => invokeSetJobStatus(id, 'queued')));
  // Use autoAdvanceQueue so the dispatch guard is always set for the first job.
  // Direct invokeProcessQueue calls here bypassed _lastDispatchedJobId, allowing
  // the same job to be double-dispatched before its 'processing' event arrived.
  await autoAdvanceQueue(tab);
}

export async function triggerConvertAll(): Promise<void> {
  const tab = useUIStore.getState().audioSubTab;
  const { tabQueues, tabImportingIds, setStatus, setJobOperationMode } = useQueueStore.getState();
  const importingIds = new Set(tabImportingIds[tab]);
  const ids = tabQueues[tab]
    .filter((j) => j.status === 'pending' && !importingIds.has(j.id))
    .map((j) => j.id);
  if (!ids.length) return;

  log.info(`Convert All: queuing ${ids.length} job(s)`);
  ids.forEach((id) => { setJobOperationMode(id, 'convert', tab); setStatus(id, 'queued'); });
  await Promise.all(ids.map((id) => invokeSetJobStatus(id, 'queued')));
  // Use autoAdvanceQueue so the dispatch guard is set — same fix as triggerEnhanceAll.
  await autoAdvanceQueue(tab);
}

export async function triggerReEnhance(): Promise<void> {
  const tab = useUIStore.getState().audioSubTab;
  const { tabQueues, tabSelectedIds, insertJobAtTop, setUsedSettings } = useQueueStore.getState();
  const { enhancementStrength, aiModel, hfDeHissDb } = useSettingsStore.getState();
  const { addToast } = useToastStore.getState();

  const selectedIds = tabSelectedIds[tab];
  const jobs = tabQueues[tab];
  const doneJobs: QueueJob[] = selectedIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is QueueJob => j !== undefined && j.status === 'done');

  if (!doneJobs.length) return;

  // Phase 1: add all new jobs to the store first (before any processing starts)
  const newJobs: QueueJob[] = [];
  for (const job of doneJobs) {
    try {
      const res = await invokeAddFiles([job.filepath]);
      if (res.success && res.data && res.data.length > 0) {
        const newJob = res.data[0];
        insertJobAtTop(newJob, tab);
        setUsedSettings(newJob.id, enhancementStrength, hfDeHissDb ?? -4);
        newJobs.push(newJob);
      } else {
        addToast(`Re-enhance failed: ${res.error ?? 'Could not add file'}`, 'error');
      }
    } catch (err) {
      logError('re-enhance', String(err));
      addToast(`Re-enhance failed for "${job.filename}"`, 'error');
    }
  }

  if (!newJobs.length) return;

  // Phase 2: queue all new jobs, then start the first — mirrors triggerEnhanceAll
  const hasActive = useQueueStore.getState().tabQueues[tab].some((j) => j.status === 'processing');
  newJobs.forEach((j) => useQueueStore.getState().setStatus(j.id, 'queued'));
  await Promise.all(newJobs.map((j) => invokeSetJobStatus(j.id, 'queued')));

  if (!hasActive) {
    const first = newJobs[0];
    invokeProcessQueue([first.id], enhancementStrength, aiModel ?? 'deepfilternet', hfDeHissDb ?? -4).catch(
      (err) => { console.error('Failed to start re-enhance job', err); },
    );
  }
}

// ── Sequential-queue dispatch guard ──────────────────────────────────────────
//
// Prevents a job from being dispatched twice before the backend emits its first
// 'processing' event. Without this guard, two rapid 'done'/'error' events from
// the backend can both pass the isAnyProcessing=false check (the new job's
// Zustand state hasn't updated yet) and call invokeProcessQueue twice for the
// same queued job.

let _lastDispatchedJobId: string | null = null;

export function clearDispatchGuard(confirmedJobId: string): void {
  if (_lastDispatchedJobId === confirmedJobId) {
    _lastDispatchedJobId = null;
  }
}

export function _resetDispatchGuardForTest(): void {
  _lastDispatchedJobId = null;
}

export async function autoAdvanceQueue(jobTab: AudioSubTab): Promise<void> {
  const { tabQueues, tabJobOpTypes } = useQueueStore.getState();
  const tabJobs = tabQueues[jobTab];
  const isAnyProcessing = tabJobs.some((j) => j.status === 'processing');
  if (isAnyProcessing) return;

  const nextQueued = tabJobs.find((j) => j.status === 'queued');
  if (!nextQueued) return;
  if (nextQueued.id === _lastDispatchedJobId) return;

  _lastDispatchedJobId = nextQueued.id;

  const { aiModel, enhancementStrength, filenameTemplateConverted, hfDeHissDb } = useSettingsStore.getState();
  const opType = tabJobOpTypes[jobTab][nextQueued.id] ?? 'enhance';
  if (opType === 'enhance') {
    await invokeProcessQueue([nextQueued.id], enhancementStrength, aiModel, hfDeHissDb ?? -4);
  } else {
    await invokeConvertFiles([nextQueued.id], filenameTemplateConverted);
  }
}

// ── Auto-retry on error (P2-C revised) ───────────────────────────────────────
//
// When a job reaches 'error', the status-change listener calls handleJobError
// instead of autoAdvanceQueue. If the job has failed fewer than MAX_JOB_RETRIES
// times it is reset to 'queued' and re-dispatched automatically. After
// MAX_JOB_RETRIES failures the job stays in 'error' and the queue advances
// to the next job normally.

const MAX_JOB_RETRIES = 3;
const _jobRetryCounts: Record<string, number> = {};

export function _resetRetryCountsForTest(): void {
  for (const k of Object.keys(_jobRetryCounts)) delete _jobRetryCounts[k];
}

export function willRetry(jobId: string): boolean {
  return (_jobRetryCounts[jobId] ?? 0) < MAX_JOB_RETRIES;
}

export async function handleJobError(jobId: string, jobTab: AudioSubTab): Promise<void> {
  const count = _jobRetryCounts[jobId] ?? 0;
  if (count < MAX_JOB_RETRIES) {
    _jobRetryCounts[jobId] = count + 1;
    clearDispatchGuard(jobId);
    useQueueStore.getState().setStatus(jobId, 'queued');
    await invokeSetJobStatus(jobId, 'queued');
    await autoAdvanceQueue(jobTab);
  } else {
    delete _jobRetryCounts[jobId];
    clearDispatchGuard(jobId);
    // Ensure job stays in 'error' — the last retry may have left it as 'queued'
    // before the backend had time to transition it back.
    useQueueStore.getState().setStatus(jobId, 'error');
    await autoAdvanceQueue(jobTab);
  }
}

export async function triggerCancelAll(): Promise<void> {
  const tab = useUIStore.getState().audioSubTab;
  const { tabQueues } = useQueueStore.getState();
  const { addToast } = useToastStore.getState();
  const activeIds = tabQueues[tab]
    .filter((j) => j.status === 'processing' || j.status === 'queued')
    .map((j) => j.id);
  log.info(`Cancel All [${tab}]: cancelling ${activeIds.length} active job(s)`);
  if (activeIds.length > 0) {
    try {
      await invokeCancelJobs(activeIds);
      addToast(`Cancelled ${activeIds.length} job${activeIds.length > 1 ? 's' : ''}`, 'info');
    } catch (err) {
      log.error('Cancel All failed', err);
    }
  }
}
