use std::sync::{Arc, Mutex};

use axum::{extract::State, routing::post, Json, Router};
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::db::queue as db_queue;

#[derive(Clone)]
pub struct CallbackState {
    pub app: AppHandle,
    pub db: Arc<Mutex<Connection>>,
}

#[derive(Deserialize)]
pub struct ProgressPayload {
    pub job_id: String,
    pub percent: u8,
}

#[derive(Deserialize)]
pub struct StatusPayload {
    pub job_id: String,
    pub status: String,
    pub error_message: Option<String>,
    pub output_filepath: Option<String>,
}

#[derive(Deserialize)]
pub struct WizardPayload {
    #[serde(rename = "type")]
    pub kind: String,
    pub percent: Option<u8>,
    pub message: Option<String>,
}

pub fn build_router(state: CallbackState) -> Router {
    Router::new()
        .route("/callback/progress", post(handle_progress))
        .route("/callback/status", post(handle_status))
        .route("/callback/wizard", post(handle_wizard))
        .with_state(state)
}

async fn handle_progress(State(s): State<CallbackState>, Json(p): Json<ProgressPayload>) {
    let _ = s.app.emit(
        "queue://progress",
        json!({ "jobId": p.job_id, "percent": p.percent }),
    );
}

async fn handle_status(State(s): State<CallbackState>, Json(p): Json<StatusPayload>) {
    {
        let conn = s.db.lock().unwrap();
        if p.status == "error" {
            let msg = p.error_message.as_deref().unwrap_or("Unknown error");
            let _ = db_queue::update_job_error(&conn, &p.job_id, msg);
        } else {
            let _ = db_queue::update_job_status(&conn, &p.job_id, &p.status);
            if let Some(ref fp) = p.output_filepath {
                let _ = db_queue::update_job_output_filepath(&conn, &p.job_id, fp);
            }
        }
    }
    let _ = s.app.emit(
        "queue://status-change",
        json!({
            "jobId": p.job_id,
            "status": p.status,
            "outputFilepath": p.output_filepath,
        }),
    );
}

async fn handle_wizard(State(s): State<CallbackState>, Json(p): Json<WizardPayload>) {
    match p.kind.as_str() {
        "progress" => {
            let _ = s.app.emit(
                "wizard://progress",
                json!({
                    "percent": p.percent.unwrap_or(0),
                    "message": p.message.as_deref().unwrap_or(""),
                }),
            );
        }
        "complete" => {
            let _ = s.app.emit("wizard://complete", json!({}));
        }
        "error" => {
            let _ = s.app.emit(
                "wizard://error",
                json!({ "message": p.message.unwrap_or_default() }),
            );
        }
        _ => {}
    }
}
