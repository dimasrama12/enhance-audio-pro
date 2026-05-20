import { invoke } from '@tauri-apps/api/core';
import type { IpcResponse } from '@/types/ipc';
import type { QueueJob } from '@/types/queue';
import type { AppSettings } from '@/types/settings';

export async function invokeAddFiles(paths: string[]): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('add_files', { paths });
}

export async function invokeGetQueue(): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('get_queue');
}

export async function invokeGetSettings(): Promise<IpcResponse<AppSettings>> {
  return invoke<IpcResponse<AppSettings>>('get_settings');
}

export async function invokeSaveSettings(settings: AppSettings): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('save_settings', { settings });
}
