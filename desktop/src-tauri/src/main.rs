use tauri::Manager;

mod commands;
mod core;
mod config;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            env_logger::init();
            log::info!("Kapowie desktop starting up");
            Ok(())
        })
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
