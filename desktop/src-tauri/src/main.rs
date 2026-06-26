use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use tauri::Manager;

mod commands;
mod core;
mod config;

pub struct AppState {
    pub recordings: Arc<Mutex<HashMap<String, commands::capture::RecordingState>>>,
    pub restreams: Arc<Mutex<HashMap<String, commands::restream::ReStreamStatus>>>,
}

// Tauri state wrappers
pub struct RecordingsState(pub Arc<Mutex<HashMap<String, commands::capture::RecordingState>>>);
pub struct RestreamsState(pub Arc<Mutex<HashMap<String, commands::restream::ReStreamStatus>>>);

fn main() {
    let recordings = Arc::new(Mutex::new(HashMap::new()));
    let restreams = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            env_logger::init();
            log::info!("Kapowie desktop starting up");
            Ok(())
        })
        .manage(RecordingsState(recordings.clone()))
        .manage(RestreamsState(restreams.clone()))
        .invoke_handler(tauri::generate_handler![
            commands::capture::get_stream_info,
            commands::capture::start_recording,
            commands::capture::stop_recording,
            commands::capture::list_recordings,
            commands::recording::delete_recording,
            commands::recording::get_recording_path,
            commands::recording::open_recording_folder,
            commands::restream::start_restream,
            commands::restream::stop_restream,
            commands::restream::get_restream_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kapowie application");
}
