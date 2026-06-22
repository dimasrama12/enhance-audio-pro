use std::path::Path;
use tauri::{Manager, State};

const SUPPORTED_AUDIO_VIDEO_EXTENSIONS: &[&str] = &[
    "mp3", "wav", "flac", "aac", "ogg", "opus", "m4a", "wma", "aiff", "mp2",
    "mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v", "ts", "mts", "m2ts",
];

use crate::commands::IpcResponse;
use crate::db::queue::{
    get_all_jobs, get_recent_jobs, insert_job, QueueJob,
    archive_job, archive_all_jobs, delete_job_by_id, delete_all_history as db_delete_all_history,
};
use crate::AppState;

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"];

#[tauri::command]
pub fn add_files(state: State<AppState>, paths: Vec<String>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
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
                if VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) { "video" } else { "audio" }
            })
            .unwrap_or("audio");

        match insert_job(&conn, path_str, &filename, size_bytes, media_type) {
            Ok(job) => {
                jobs.push(job);
            }
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        }
    }

    IpcResponse { success: true, data: Some(jobs), error: None }
}

/// List all supported audio/video files in a folder (non-recursive, one level deep).
#[tauri::command]
pub fn list_folder_files(folder: String) -> IpcResponse<Vec<String>> {
    let path = Path::new(&folder);
    if !path.is_dir() {
        return IpcResponse { success: false, data: None, error: Some("Not a directory".into()) };
    }
    let mut files: Vec<String> = Vec::new();
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    for entry in entries.flatten() {
        let entry_path = entry.path();
        if !entry_path.is_file() { continue; }
        if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
            if SUPPORTED_AUDIO_VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                if let Some(s) = entry_path.to_str() {
                    files.push(s.to_string());
                }
            }
        }
    }
    files.sort();
    IpcResponse { success: true, data: Some(files), error: None }
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

#[tauri::command]
pub fn archive_jobs(state: State<AppState>, ids: Vec<String>) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    for id in &ids {
        if let Err(e) = archive_job(&conn, id) {
            return IpcResponse { success: false, data: None, error: Some(e.to_string()) };
        }
    }

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub fn archive_all_queue(state: State<AppState>) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    match archive_all_jobs(&conn) {
        Ok(_) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn delete_job(state: State<AppState>, id: String) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    match delete_job_by_id(&conn, &id) {
        Ok(_) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn delete_all_history(state: State<AppState>) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    match db_delete_all_history(&conn) {
        Ok(_) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

/// Append a markdown-formatted error entry to a daily log file under app_data_dir/error-logs/.
#[tauri::command]
pub fn append_error_log(app_handle: tauri::AppHandle, entry: String) -> IpcResponse<()> {
    use std::io::Write;
    let data_dir = match app_handle.path().app_data_dir() {
        Ok(d) => d,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    let log_dir = data_dir.join("error-logs");
    if let Err(e) = std::fs::create_dir_all(&log_dir) {
        return IpcResponse { success: false, data: None, error: Some(e.to_string()) };
    }
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let log_file = log_dir.join(format!("{}.md", today));
    match std::fs::OpenOptions::new().create(true).append(true).open(&log_file) {
        Ok(mut f) => {
            let _ = writeln!(f, "{}", entry);
            IpcResponse { success: true, data: Some(()), error: None }
        }
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

/// Read a local audio file and return its raw bytes as a binary IPC response.
/// This bypasses the asset:// protocol so WaveSurfer can load via a Blob URL.
#[tauri::command]
pub fn read_audio_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn set_destination(
    state: State<'_, AppState>,
    job_id: String,
    destination: String,
) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match crate::db::queue::update_job_destination(&conn, &job_id, &destination) {
        Ok(()) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn show_item_in_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let clean_path = path.replace('/', "\\");
        std::process::Command::new("explorer.exe")
            .raw_arg(format!(r#"/select,"{}""#, clean_path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            if let Some(parent_str) = parent.to_str() {
                std::process::Command::new("xdg-open")
                    .arg(parent_str)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
}

#[tauri::command]
pub fn set_job_status(
    state: tauri::State<'_, crate::AppState>,
    app_handle: tauri::AppHandle,
    job_id: String,
    status: String,
) -> IpcResponse<()> {
    use tauri::Emitter;
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match crate::db::queue::update_job_status(&conn, &job_id, &status) {
        Ok(()) => {
            let _ = app_handle.emit(
                "queue://status-change",
                serde_json::json!({ "jobId": job_id, "status": status }),
            );
            IpcResponse { success: true, data: Some(()), error: None }
        }
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

/// Copy an enhanced file from its output location to a user-chosen destination path.
#[tauri::command]
pub fn copy_enhanced_file(
    state: tauri::State<'_, crate::AppState>,
    job_id: String,
    src_path: String,
    dest_path: String,
) -> IpcResponse<String> {
    let src = std::path::Path::new(&src_path);
    if !src.exists() {
        return IpcResponse {
            success: false,
            data: None,
            error: Some(format!("Source file not found: {}", src_path)),
        };
    }
    if let Some(parent) = std::path::Path::new(&dest_path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    if let Err(e) = std::fs::copy(&src_path, &dest_path) {
        return IpcResponse { success: false, data: None, error: Some(e.to_string()) };
    }

    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match crate::db::queue::update_job_download_path(&conn, &job_id, &dest_path) {
        Ok(()) => IpcResponse { success: true, data: Some(dest_path), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn delete_file(path: String) -> IpcResponse<()> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        if let Err(e) = std::fs::remove_file(p) {
            return IpcResponse { success: false, data: None, error: Some(e.to_string()) };
        }
    }
    IpcResponse { success: true, data: Some(()), error: None }
}

