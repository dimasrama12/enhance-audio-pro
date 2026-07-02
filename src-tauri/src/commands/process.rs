use std::sync::Arc;
use std::time::Duration;
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
    enhancement_strength: Option<f64>,
    ai_model: Option<String>,
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

    // Normalize strength: frontend sends 0-100, Python expects 0.0-1.0
    let strength = enhancement_strength.unwrap_or(50.0).clamp(0.0, 100.0) / 100.0;

    let payload = json!({
        "job_ids": updated_ids,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
        "strength": strength,
        "model_type": ai_model.unwrap_or_else(|| "deepfilternet".to_string()),
    });

    // Clone handles needed for async error recovery (if Python is unreachable)
    let recovery_ids = updated_ids.clone();
    let app_clone = app_handle.clone();
    let db_arc = Arc::clone(&state.db);

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/enhance", backend_port);

        // Retry up to 25 times (≤50 s) so PyInstaller sidecar cold-start latency is covered.
        // Cold PyInstaller binaries can take 20–40 s to extract and initialise on the first launch.
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
                    break None; // Python accepted the request — it will send callbacks
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

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}

#[tauri::command]
pub fn cancel_jobs(
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

    // Immediately revert status in DB and emit events so the UI responds instantly.
    // Only revert jobs that are still in an active state — don't clobber 'done'.
    {
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
        let now = chrono::Utc::now().to_rfc3339();
        for id in &job_ids {
            let _ = conn.execute(
                "UPDATE queue_jobs SET status = 'pending', updated_at = ?1 WHERE id = ?2 AND status IN ('processing','queued')",
                rusqlite::params![now, id],
            );
        }
    }

    for id in &job_ids {
        let _ = app_handle.emit(
            "queue://status-change",
            json!({ "jobId": id, "status": "pending" }),
        );
    }

    // Fire-and-forget cancellation signal to Python sidecar
    let ids = job_ids.clone();
    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/cancel", backend_port);
        let _ = reqwest::Client::new()
            .post(&url)
            .json(&serde_json::json!({ "job_ids": ids }))
            .timeout(Duration::from_secs(5))
            .send()
            .await;
    });

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}
