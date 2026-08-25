export type MediaType = 'audio' | 'video';
export type JobStatus = 'pending' | 'queued' | 'processing' | 'done' | 'error';

// A saved past enhancement — stored in session memory when a job is re-enhanced.
// The "terminal children" of the versioning model live here (not in SQLite).
export interface EnhanceVersion {
  versionIndex: number;    // 1-based (v1 = first enhanced output)
  outputFilepath: string;
  strength: number;
  hfDeHissDb: number;
  createdAt: number;       // Date.now()
}

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
  startedAt?: number;
  completed_duration?: number;
  ab_mode?: 'enhanced' | 'original';
  sample_rate: string;
  created_at: string;
  updated_at: string;
  download_path: string | null;
  // Set when this audio job was produced by extracting the audio stream of a
  // dropped video file. Holds the original video's path (frontend-only, not
  // persisted to SQLite). Undefined for normal audio imports.
  source_video_path?: string;
  // Settings used for the most-recent enhancement of this job (frontend-only).
  // Set when the job reaches 'done'; used to label version history entries.
  usedStrength?: number;
  usedHfDeHissDb?: number;
}
