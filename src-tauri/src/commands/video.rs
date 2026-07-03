use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::commands::IpcResponse;
use crate::AppState;

#[derive(Serialize)]
pub struct ExtractedAudio {
    pub audio_path: String,
    pub base_name: String,
}

#[derive(Deserialize)]
struct ExtractResponse {
    success: bool,
    #[serde(default)]
    audio_path: Option<String>,
    #[serde(default)]
    base_name: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

/// Demux/extract the first audio stream of a video into a default-MP3 file in the
/// scratch cache, returning the resulting audio path so the frontend can enqueue
/// it as a normal audio job. Synchronous (awaits the extraction) with a generous
/// timeout because video drops bypass all size/duration limits.
#[tauri::command]
pub async fn extract_video_audio(
    state: State<'_, AppState>,
    input_path: String,
    fmt: Option<String>,
    job_id: Option<String>,
) -> Result<IpcResponse<ExtractedAudio>, String> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;
    // Pass the placeholder row's id + callback server URL so the Python side can
    // stream real extraction progress back as `queue://progress` events.
    let payload = json!({
        "input_path": input_path,
        "fmt": fmt.unwrap_or_else(|| "mp3".to_string()),
        "job_id": job_id,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });
    let url = format!("http://127.0.0.1:{}/extract_audio", backend_port);

    // Retry a few times to tolerate sidecar cold-start; each attempt allows up to
    // 30 minutes for the actual extraction of very large videos.
    const MAX_ATTEMPTS: u32 = 8;
    let mut attempts = 0u32;
    loop {
        let result = reqwest::Client::new()
            .post(&url)
            .json(&payload)
            .timeout(Duration::from_secs(1800))
            .send()
            .await;

        match result {
            Ok(resp) => {
                let parsed = resp.json::<ExtractResponse>().await;
                return match parsed {
                    Ok(body) if body.success => Ok(IpcResponse {
                        success: true,
                        data: Some(ExtractedAudio {
                            audio_path: body.audio_path.unwrap_or_default(),
                            base_name: body.base_name.unwrap_or_default(),
                        }),
                        error: None,
                    }),
                    Ok(body) => Ok(IpcResponse {
                        success: false,
                        data: None,
                        error: Some(body.error.unwrap_or_else(|| "Extraction failed".to_string())),
                    }),
                    Err(e) => Ok(IpcResponse {
                        success: false,
                        data: None,
                        error: Some(format!("Invalid backend response: {}", e)),
                    }),
                };
            }
            Err(e) => {
                attempts += 1;
                if attempts >= MAX_ATTEMPTS {
                    return Ok(IpcResponse {
                        success: false,
                        data: None,
                        error: Some(format!("Backend unavailable after {} attempts: {}", attempts, e)),
                    });
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        }
    }
}
