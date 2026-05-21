pub mod download;
pub mod process;
pub mod queue;
pub mod separate;
pub mod settings;

use serde::Serialize;

#[derive(Serialize)]
pub struct IpcResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
