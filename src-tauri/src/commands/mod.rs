pub mod convert;
pub mod download;
pub mod manipulate;
pub mod process;
pub mod queue;
pub mod record;
pub mod settings;
pub mod video;

use serde::Serialize;

#[derive(Serialize)]
pub struct IpcResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
