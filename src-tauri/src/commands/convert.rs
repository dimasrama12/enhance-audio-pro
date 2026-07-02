use std::sync::Arc;
use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::commands::IpcResponse;
use crate::db::queue as db_queue;
use crate::AppState;

#[tauri::command]
pub fn convert_files(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_ids: Vec<String>,
    filename_template: Option<String>,
) -> IpcResponse<()> {
    if job_ids.is_empty() {
        return IpcResponse { success: true, data: Some(()), error: None };
    }

    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    let updated_ids: Vec<String> = {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        };
        job_ids
            .iter()
            .filter(|id| db_queue::update_job_status(&conn, id, "processing").is_ok())
            .cloned()
            .collect()
    };

    for id in &updated_ids {
        let _ = app_handle.emit(
            "queue://status-change",
            json!({ "jobId": id, "status": "processing" }),
        );
    }

    let payload = json!({
        "job_ids": updated_ids,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
        "filename_template": filename_template.unwrap_or_default(),
    });

    let recovery_ids = updated_ids.clone();
    let app_clone = app_handle.clone();
    let db_arc = Arc::clone(&state.db);

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/convert", backend_port);
        const MAX_ATTEMPTS: u32 = 45;
        let mut attempts = 0u32;
        let err_msg = loop {
            let result = reqwest::Client::new()
                .post(&url)
                .json(&payload)
                .timeout(Duration::from_secs(10))
                .send()
                .await;

            match result {
                Ok(resp) if resp.status().is_success() || resp.status().as_u16() == 202 => {
                    break None;
                }
                Ok(resp) => {
                    break Some(format!("Backend error: {}", resp.status()));
                }
                Err(e) => {
                    attempts += 1;
                    if attempts >= MAX_ATTEMPTS {
                        break Some(format!("Backend unavailable after {} attempts: {}", attempts, e));
                    }
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        };

        if let Some(msg) = err_msg {
            let now = chrono::Utc::now().to_rfc3339();
            if let Ok(conn) = db_arc.lock() {
                for id in &recovery_ids {
                    let _ = conn.execute(
                        "UPDATE queue_jobs SET status = 'error', error_message = ?1, updated_at = ?2 WHERE id = ?3",
                        rusqlite::params![msg, now, id],
                    );
                }
            }
            for id in &recovery_ids {
                let _ = app_clone.emit(
                    "queue://status-change",
                    json!({
                        "jobId": id,
                        "status": "error",
                        "error_message": msg,
                    }),
                );
            }
        }
    });

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub fn set_bitrate(
    state: State<'_, AppState>,
    job_id: String,
    bitrate: String,
) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match db_queue::update_job_bitrate(&conn, &job_id, &bitrate) {
        Ok(()) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn set_sample_rate(
    state: State<'_, AppState>,
    job_id: String,
    sample_rate: String,
) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match db_queue::update_job_sample_rate(&conn, &job_id, &sample_rate) {
        Ok(()) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub fn set_output_format(
    state: State<'_, AppState>,
    job_id: String,
    format: String,
) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match db_queue::update_job_output_format(&conn, &job_id, &format) {
        Ok(()) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}
