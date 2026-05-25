use tauri::State;

use crate::commands::IpcResponse;
use crate::AppState;

#[tauri::command]
pub fn start_model_download(state: State<'_, AppState>) -> IpcResponse<()> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    let payload = serde_json::json!({
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/wizard/download", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub async fn check_model_status(state: State<'_, AppState>) -> Result<IpcResponse<bool>, String> {
    let backend_port = state.backend_port;
    let url = format!("http://127.0.0.1:{}/wizard/status", backend_port);
    match reqwest::get(&url).await {
        Ok(resp) => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                let installed = body.get("installed").and_then(|v| v.as_bool()).unwrap_or(false);
                Ok(IpcResponse { success: true, data: Some(installed), error: None })
            } else {
                Ok(IpcResponse { success: false, data: Some(false), error: Some("Bad response".into()) })
            }
        }
        Err(e) => Ok(IpcResponse { success: false, data: Some(false), error: Some(e.to_string()) }),
    }
}
