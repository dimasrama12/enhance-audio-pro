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
import type { QueueJob } from '@/types/queue';

const log = createLogger('QueueActions');

export async function triggerEnhanceAll(): Promise<void> {
  const tab = useUIStore.getState().audioSubTab;
  const { tabQueues, tabImportingIds, setStatus } = useQueueStore.getState();
  const { enhancementStrength, aiModel, hfDeHissDb } = useSettingsStore.getState();
  const importingIds = new Set(tabImportingIds[tab]);
  const enhIds = tabQueues[tab]
    .filter((j) => (j.status === 'pending' || j.status === 'error') && !importingIds.has(j.id))
    .map((j) => j.id);
  if (!enhIds.length) return;

  log.info(`Enhance All: queuing ${enhIds.length} job(s)`);
  enhIds.forEach((id) => setStatus(id, 'queued'));
  await Promise.all(enhIds.map((id) => invokeSetJobStatus(id, 'queued')));
  const freshJobs = useQueueStore.getState().tabQueues[tab];
  if (!freshJobs.some((j) => j.status === 'processing')) {
    const next = freshJobs.find((j) => j.status === 'queued');
    if (next) {
      invokeProcessQueue([next.id], enhancementStrength, aiModel, hfDeHissDb ?? -4).catch((err) => {
        console.error('Failed to auto-start queued job', err);
      });
    }
  }
}

export async function triggerConvertAll(): Promise<void> {
  const tab = useUIStore.getState().audioSubTab;
  const { tabQueues, tabImportingIds, setStatus, setJobOperationMode } = useQueueStore.getState();
  const { filenameTemplateConverted } = useSettingsStore.getState();
  const importingIds = new Set(tabImportingIds[tab]);
  const ids = tabQueues[tab]
    .filter((j) => j.status === 'pending' && !importingIds.has(j.id))
    .map((j) => j.id);
  if (!ids.length) return;

  log.info(`Convert All: queuing ${ids.length} job(s)`);
  ids.forEach((id) => { setJobOperationMode(id, 'convert', tab); setStatus(id, 'queued'); });
  await Promise.all(ids.map((id) => invokeSetJobStatus(id, 'queued')));
  const freshJobs = useQueueStore.getState().tabQueues[tab];
  if (!freshJobs.some((j) => j.status === 'processing')) {
    const next = freshJobs.find((j) => j.status === 'queued');
    if (next) {
      invokeConvertFiles([next.id], filenameTemplateConverted).catch((err) => {
        console.error('Failed to auto-start convert job', err);
      });
    }
  }
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
