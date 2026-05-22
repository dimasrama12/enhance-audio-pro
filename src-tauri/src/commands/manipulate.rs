use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::commands::IpcResponse;
use crate::db::queue as db_queue;
use crate::AppState;

#[tauri::command]
pub fn manipulate_audio(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_id: String,
    operation: String,
    params: serde_json::Value,
) -> IpcResponse<()> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        };
        let _ = db_queue::update_job_status(&conn, &job_id, "processing");
    }

    let _ = app_handle.emit(
        "queue://status-change",
        json!({ "jobId": &job_id, "status": "processing" }),
    );

    let payload = json!({
        "job_id": job_id,
        "operation": operation,
        "params": params,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/manipulate", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub fn merge_audio(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_ids: Vec<String>,
    crossfade_sec: f64,
) -> IpcResponse<()> {
    if job_ids.is_empty() {
        return IpcResponse { success: true, data: Some(()), error: None };
    }

    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        };
        for id in &job_ids {
            let _ = db_queue::update_job_status(&conn, id, "processing");
        }
    }

    for id in &job_ids {
        let _ = app_handle.emit(
            "queue://status-change",
            json!({ "jobId": id, "status": "processing" }),
        );
    }

    let payload = json!({
        "job_ids": job_ids,
        "crossfade_sec": crossfade_sec,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/merge", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub fn loop_audio(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_id: String,
    target_duration_sec: f64,
) -> IpcResponse<()> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        };
        let _ = db_queue::update_job_status(&conn, &job_id, "processing");
    }

    let _ = app_handle.emit(
        "queue://status-change",
        json!({ "jobId": &job_id, "status": "processing" }),
    );

    let payload = json!({
        "job_id": job_id,
        "target_duration_sec": target_duration_sec,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/loop", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub fn apply_eq(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_id: String,
    gains: Vec<f64>,
) -> IpcResponse<()> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        };
        let _ = db_queue::update_job_status(&conn, &job_id, "processing");
    }

    let _ = app_handle.emit(
        "queue://status-change",
        json!({ "jobId": &job_id, "status": "processing" }),
    );

    let payload = json!({
        "job_id": job_id,
        "gains": gains,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/eq", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse { success: true, data: Some(()), error: None }
}
