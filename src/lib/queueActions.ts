import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  invokeProcessQueue,
  invokeConvertFiles,
  invokeCancelJobs,
  invokeSetJobStatus,
} from '@/lib/ipc';
import { createLogger } from '@/lib/logger';

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
