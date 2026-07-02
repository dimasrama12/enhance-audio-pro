use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;

mod callback;
mod commands;
mod db;
mod sidecar;

use commands::convert::{convert_files, set_bitrate, set_output_format, set_sample_rate};
use commands::record::save_recording;
use commands::download::{check_model_status, start_model_download};
use commands::manipulate::{apply_eq, loop_audio, manipulate_audio, merge_audio, export_volume_adjusted_audio};
use commands::process::{cancel_jobs, process_queue};
use commands::queue::{
    add_files, list_folder_files, get_queue, get_recent_history, archive_jobs, archive_all_queue,
    delete_job, delete_all_history, read_audio_file, set_destination, show_item_in_folder,
    set_job_status, append_error_log, copy_enhanced_file, delete_file,
};
use commands::settings::{get_settings, save_settings, get_scratch_disk_dir, save_scratch_disk_dir};

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    pub backend_port: u16,
    pub callback_port: u16,
    // Held so we can kill the Python sidecar on app close
    pub sidecar_child: Mutex<Option<CommandChild>>,
    pub scratch_disk_dir: String,
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
            // Archive active items from previous session so queue starts empty on launch
            let _ = conn.execute("UPDATE queue_jobs SET archived = 1 WHERE archived = 0", []);
            let db = Arc::new(Mutex::new(conn));

            // Read saved scratch disk dir from file (persisted by save_scratch_disk_dir command)
            let scratch_disk_txt = data_dir.join("scratch_disk.txt");
            let scratch_disk_dir = std::fs::read_to_string(&scratch_disk_txt)
                .unwrap_or_default()
                .trim()
                .to_string();

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
            let child = sidecar::manager::spawn(app.handle(), backend_port, callback_port, &scratch_disk_dir)?;

            app.manage(AppState {
                db,
                backend_port,
                callback_port,
                sidecar_child: Mutex::new(Some(child)),
                scratch_disk_dir,
            });

            Ok(())
        })
        // Kill sidecar and force-exit when any window is closed
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();

                let state = window.state::<AppState>();
                // Clean up temporary files (recordings/caches) stored in system temp dir,
                // then purge history so the next session opens with a clean state.
                if let Ok(conn) = state.db.lock() {
                    cleanup_temp_files(window.app_handle(), &conn);
                    let _ = conn.execute(
                        "DELETE FROM queue_jobs WHERE status IN ('done', 'error')",
                        [],
                    );
                }

                // Kill Python backend sidecar first so no orphaned processes remain and files are unlocked
                if let Ok(mut child_lock) = state.sidecar_child.lock() {
                    if let Some(child) = child_lock.take() {
                        let _ = child.kill();
                    }
                }
                // Sleep briefly to let OS release file locks on Windows
                std::thread::sleep(std::time::Duration::from_millis(150));

                // Clean up scratch disk or system temp cache dir recursively
                let scratch_disk = state.scratch_disk_dir.clone();
                let cache_dir = if !scratch_disk.is_empty() {
                    std::path::Path::new(&scratch_disk).join("enhance-audio-pro-cache")
                } else if let Ok(temp_dir) = window.app_handle().path().temp_dir() {
                    temp_dir.join("enhance-audio-pro-cache")
                } else {
                    std::path::PathBuf::new()
                };
                if !cache_dir.as_os_str().is_empty() && cache_dir.is_dir() {
                    let _ = std::fs::remove_dir_all(&cache_dir);
                }

                // Force-exit the entire process (all threads, Axum server, etc.)
                std::process::exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            add_files,
            list_folder_files,
            get_queue,
            get_recent_history,
            archive_jobs,
            archive_all_queue,
            delete_job,
            delete_all_history,
            get_settings,
            save_settings,
            get_scratch_disk_dir,
            save_scratch_disk_dir,
            process_queue,
            cancel_jobs,
            start_model_download,
            check_model_status,
            convert_files,
            set_output_format,
            set_bitrate,
            set_sample_rate,
            save_recording,
            manipulate_audio,
            merge_audio,
            loop_audio,
            apply_eq,
            export_volume_adjusted_audio,
            read_audio_file,
            set_destination,
            show_item_in_folder,
            set_job_status,
            append_error_log,
            copy_enhanced_file,
            delete_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn cleanup_temp_files(app_handle: &tauri::AppHandle, db: &rusqlite::Connection) {
    if let Ok(temp_dir) = app_handle.path().temp_dir() {
        if let Ok(mut stmt) = db.prepare("SELECT filepath, output_filepath FROM queue_jobs") {
            let paths_iter = stmt.query_map([], |row| {
                let fp: Option<String> = row.get(0).ok();
                let ofp: Option<String> = row.get(1).ok();
                Ok((fp, ofp))
            });
            if let Ok(rows) = paths_iter {
                for row_res in rows {
                    if let Ok((fp, ofp)) = row_res {
                        for path_str_opt in &[fp, ofp] {
                            if let Some(path_str) = path_str_opt {
                                if !path_str.is_empty() {
                                    let p = std::path::Path::new(path_str);
                                    if p.starts_with(&temp_dir) && p.is_file() {
                                        let _ = std::fs::remove_file(p);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
