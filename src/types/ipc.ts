export interface IpcResponse<T = null> {
  success: boolean;
  data: T | null;
  error: string | null;
}
