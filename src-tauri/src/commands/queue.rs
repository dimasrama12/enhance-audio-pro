use std::path::Path;
use tauri::State;

use crate::commands::IpcResponse;
use crate::db::queue::{get_all_jobs, insert_job, QueueJob};
use crate::AppState;

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"];

#[tauri::command]
pub fn add_files(state: State<AppState>, paths: Vec<String>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return IpcResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }
        }
    };

    let mut jobs = Vec::new();
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
                if VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    "video"
                } else {
                    "audio"
                }
            })
            .unwrap_or("audio");

        match insert_job(&conn, path_str, &filename, size_bytes, media_type) {
            Ok(job) => jobs.push(job),
            Err(e) => {
                return IpcResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                }
            }
        }
    }

    IpcResponse {
        success: true,
        data: Some(jobs),
        error: None,
    }
}

#[tauri::command]
pub fn get_queue(state: State<AppState>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => {
            return IpcResponse {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }
        }
    };

    match get_all_jobs(&conn) {
        Ok(jobs) => IpcResponse {
            success: true,
            data: Some(jobs),
            error: None,
        },
        Err(e) => IpcResponse {
            success: false,
            data: None,
            error: Some(e.to_string()),
        },
    }
}
