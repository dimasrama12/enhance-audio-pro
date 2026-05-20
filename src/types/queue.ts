export type MediaType = 'audio' | 'video';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface QueueJob {
  id: string;
  filename: string;
  filepath: string;
  destination: string;
  size_bytes: number;
  media_type: MediaType;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}
