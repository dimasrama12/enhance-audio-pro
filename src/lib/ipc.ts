import { invoke } from '@tauri-apps/api/core';
import type { IpcResponse } from '@/types/ipc';
import type { QueueJob } from '@/types/queue';
import type { AppSettings } from '@/types/settings';

export async function invokeAddFiles(paths: string[]): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('add_files', { paths });
}

export async function invokeSetDestination(jobId: string, destination: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('set_destination', { jobId, destination });
}

export async function invokeSetJobStatus(jobId: string, status: string): Promise<IpcResponse<void>> {
  return invoke<IpcResponse<void>>('set_job_status', { jobId, status });
}

export async function invokeShowItemInFolder(path: string): Promise<IpcResponse<null>> {
  try {
    await invoke('show_item_in_folder', { path });
    return { success: true, data: null, error: null };
  } catch (err) {
    return { success: false, data: null, error: String(err) };
  }
}

export async function invokeListFolderFiles(folder: string): Promise<IpcResponse<string[]>> {
  return invoke<IpcResponse<string[]>>('list_folder_files', { folder });
}

export async function invokeGetQueue(): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('get_queue');
}

export async function invokeGetRecentHistory(): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('get_recent_history');
}

export async function invokeArchiveJobs(ids: string[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('archive_jobs', { ids });
}

export async function invokeArchiveAllQueue(): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('archive_all_queue');
}

export async function invokeDeleteJob(id: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('delete_job', { id });
}

export async function invokeDeleteAllHistory(): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('delete_all_history');
}

export async function invokeGetSettings(): Promise<IpcResponse<AppSettings>> {
  return invoke<IpcResponse<AppSettings>>('get_settings');
}

export async function invokeSaveSettings(settings: AppSettings): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('save_settings', { settings });
}

export async function invokeProcessQueue(jobIds: string[], enhancementStrength = 50, aiModel = 'deepfilternet'): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('process_queue', { jobIds, enhancementStrength, aiModel });
}

export async function invokeSetBitrate(jobId: string, bitrate: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('set_bitrate', { jobId, bitrate });
}

export async function invokeStartModelDownload(): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('start_model_download');
}

export async function invokeCheckModelStatus(): Promise<IpcResponse<boolean>> {
  return invoke<IpcResponse<boolean>>('check_model_status');
}

export async function invokeSeparateStems(jobIds: string[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('separate_stems', { jobIds });
}

export async function invokeConvertFiles(jobIds: string[], filenameTemplate?: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('convert_files', { jobIds, filenameTemplate: filenameTemplate ?? '' });
}

export async function invokeSetOutputFormat(jobId: string, format: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('set_output_format', { jobId, format });
}

export async function invokeManipulateAudio(
  jobId: string,
  operation: string,
  params: Record<string, number>,
): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('manipulate_audio', { jobId, operation, params });
}

export async function invokeMergeAudio(jobIds: string[], crossfadeSec: number): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('merge_audio', { jobIds, crossfadeSec });
}

export async function invokeLoopAudio(jobId: string, targetDurationSec: number): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('loop_audio', { jobId, targetDurationSec });
}

export async function invokeApplyEQ(jobId: string, gains: number[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('apply_eq', { jobId, gains });
}

export async function invokeSetSampleRate(jobId: string, sampleRate: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('set_sample_rate', { jobId, sampleRate });
}

export async function invokeSaveRecording(bytes: number[], filename: string): Promise<IpcResponse<string>> {
  return invoke<IpcResponse<string>>('save_recording', { bytes, filename });
}

export async function invokeCancelJobs(jobIds: string[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('cancel_jobs', { jobIds });
}

export async function invokeGetScratchDiskDir(): Promise<IpcResponse<string>> {
  return invoke<IpcResponse<string>>('get_scratch_disk_dir');
}

export async function invokeSaveScratchDiskDir(path: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('save_scratch_disk_dir', { path });
}
