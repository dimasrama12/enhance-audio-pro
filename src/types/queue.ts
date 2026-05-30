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
  progress: number;
  error_message: string | null;
  output_format: string;
  bitrate: string;
  output_filepath: string | null;
  ab_mode?: 'enhanced' | 'original';
  sample_rate: string;
  created_at: string;
  updated_at: string;
}
