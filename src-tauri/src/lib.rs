use std::sync::{Arc, Mutex};
use tauri::Manager;

mod callback;
mod commands;
mod db;
mod sidecar;

use commands::convert::{convert_files, set_output_format};
use commands::download::start_model_download;
use commands::manipulate::{apply_eq, loop_audio, manipulate_audio, merge_audio};
use commands::process::process_queue;
use commands::queue::{add_files, get_queue};
use commands::separate::separate_stems;
use commands::settings::{get_settings, save_settings};

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    pub backend_port: u16,
    pub callback_port: u16,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let db_path = data_dir.join("app.db");
            let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
            db::migrations::run_migrations(&conn).map_err(|e| e.to_string())?;
            let db = Arc::new(Mutex::new(conn));

            // Bind callback server to a random OS-assigned port
            let cb_listener = std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|e| e.to_string())?;
            cb_listener.set_nonblocking(true).map_err(|e| e.to_string())?;
            let callback_port = cb_listener.local_addr().unwrap().port();

            // Spawn axum callback server in Tauri's async runtime
            let cb_state = callback::CallbackState {
                app: app.handle().clone(),
                db: db.clone(),
            };
            tauri::async_runtime::spawn(async move {
                let listener = tokio::net::TcpListener::from_std(cb_listener).unwrap();
                let router = callback::build_router(cb_state);
                axum::serve(listener, router).await.unwrap();
            });

            let backend_port = sidecar::manager::available_port();
            sidecar::manager::spawn(app.handle(), backend_port, callback_port)?;

            app.manage(AppState {
                db,
                backend_port,
                callback_port,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_files,
            get_queue,
            get_settings,
            save_settings,
            process_queue,
            start_model_download,
            separate_stems,
            convert_files,
            set_output_format,
            manipulate_audio,
            merge_audio,
            loop_audio,
            apply_eq,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
