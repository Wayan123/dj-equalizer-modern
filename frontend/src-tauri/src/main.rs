#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::db::DbState;

#[tokio::main]
async fn main() {
    // Fix WebKitGTK crash on Linux/NVIDIA (DMA-BUF renderer bug)
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    // Ensure WebKitGTK can find GStreamer plugins for media playback
    if std::env::var("GST_PLUGIN_PATH").is_err() {
        let plugin_path = "/usr/lib/x86_64-linux-gnu/gstreamer-1.0";
        if std::path::Path::new(plugin_path).exists() {
            std::env::set_var("GST_PLUGIN_PATH", plugin_path);
        }
    }
    // Reduce GStreamer debug noise
    if std::env::var("GST_DEBUG").is_err() {
        std::env::set_var("GST_DEBUG", "1");
    }

    // Initialize database
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("modern-audio-enhancer")
        .join("playlist.db");

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let db = commands::db::Db::new(&db_path.to_string_lossy()).expect("Failed to init database");
    let db_state = DbState(std::sync::Mutex::new(db));

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(db_state)
        .invoke_handler(tauri::generate_handler![
            commands::youtube::youtube_extract,
            commands::youtube::youtube_search,
            commands::youtube::download_audio,
            commands::playlist::playlist_list,
            commands::playlist::playlist_add,
            commands::playlist::playlist_delete,
            commands::playlist::playlist_clear,
            commands::playlist::playlist_update_cdn,
            commands::presets::preset_save,
            commands::presets::preset_load_all,
            commands::presets::preset_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
