use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::commands::IpcResponse;
use crate::db::queue as db_queue;
use crate::AppState;

#[tauri::command]
pub fn process_queue(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_ids: Vec<String>,
) -> IpcResponse<()> {
    if job_ids.is_empty() {
        return IpcResponse {
            success: true,
            data: Some(()),
            error: None,
        };
    }

    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    // Update selected jobs to 'processing' and collect IDs
    let updated_ids: Vec<String> = {
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

        job_ids
            .iter()
            .filter(|id| db_queue::update_job_status(&conn, id, "processing").is_ok())
            .cloned()
            .collect()
    };

    // Emit status-change for every updated job
    for id in &updated_ids {
        let _ = app_handle.emit(
            "queue://status-change",
            json!({ "jobId": id, "status": "processing" }),
        );
    }

    // Fire-and-forget to Python — Python processes jobs serially and calls back
    let payload = json!({
        "job_ids": updated_ids,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/enhance", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}
