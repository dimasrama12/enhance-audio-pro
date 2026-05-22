use std::path::Path;
use tauri::State;

use crate::commands::IpcResponse;
use crate::db::queue::{count_active_jobs_by_type, get_all_jobs, get_recent_jobs, insert_job, QueueJob};
use crate::AppState;

const MAX_AUDIO: i64 = 30;
const MAX_VIDEO: i64 = 10;
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"];

#[tauri::command]
pub fn add_files(state: State<AppState>, paths: Vec<String>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    let mut audio_count = count_active_jobs_by_type(&conn, "audio").unwrap_or(0);
    let mut video_count = count_active_jobs_by_type(&conn, "video").unwrap_or(0);

    let mut jobs = Vec::new();
    let mut rejected: usize = 0;

    for path_str in &paths {
        let path = Path::new(path_str);

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let size_bytes = std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0);

        let media_type = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|ext| {
                if VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) { "video" } else { "audio" }
            })
            .unwrap_or("audio");

        let at_limit = if media_type == "video" {
            video_count >= MAX_VIDEO
        } else {
            audio_count >= MAX_AUDIO
        };

        if at_limit {
            rejected += 1;
            continue;
        }

        match insert_job(&conn, path_str, &filename, size_bytes, media_type) {
            Ok(job) => {
                if media_type == "video" { video_count += 1; } else { audio_count += 1; }
                jobs.push(job);
            }
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        }
    }

    let warning = if rejected > 0 {
        Some(format!(
            "{} file(s) not added — batch limit reached (max {} audio, {} video active at once).",
            rejected, MAX_AUDIO, MAX_VIDEO
        ))
    } else {
        None
    };

    IpcResponse { success: true, data: Some(jobs), error: warning }
}

#[tauri::command]
pub fn get_queue(state: State<AppState>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    match get_all_jobs(&conn) {
        Ok(jobs) => IpcResponse { success: true, data: Some(jobs), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn get_recent_history(state: State<AppState>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    match get_recent_jobs(&conn, 50) {
        Ok(jobs) => IpcResponse { success: true, data: Some(jobs), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}
