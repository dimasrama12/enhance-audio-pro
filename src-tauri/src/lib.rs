use tauri::Manager;

mod commands;
mod db;
mod sidecar;

use commands::queue::{add_files, get_queue};
use commands::settings::{get_settings, save_settings};

pub struct AppState {
    pub db: std::sync::Mutex<rusqlite::Connection>,
    pub backend_port: u16,
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
            let conn = rusqlite::Connection::open(&db_path)
                .map_err(|e| e.to_string())?;
            db::migrations::run_migrations(&conn)
                .map_err(|e| e.to_string())?;

            let port = sidecar::manager::available_port();
            sidecar::manager::spawn(app.handle(), port)?;

            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
                backend_port: port,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_files,
            get_queue,
            get_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
