use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingMeta {
    pub id: String,
    pub url: String,
    pub output_path: String,
    pub status: String,
    pub file_size: u64,
    pub created_at: String,
}

fn get_recordings_dir() -> String {
    let dir = dirs::download_dir().unwrap_or_else(|| {
        log::warn!("Could not resolve system download directory; falling back to current working directory");
        std::env::current_dir().unwrap_or_default()
    });
    dir.join("Kapowie/Recordings").to_string_lossy().to_string()
}

#[tauri::command]
pub async fn delete_recording(path: String) -> Result<(), String> {
    let recordings_dir = Path::new(&get_recordings_dir())
        .canonicalize()
        .map_err(|e| format!("Failed to resolve recordings directory: {}", e))?;

    let path_obj = Path::new(&path)
        .canonicalize()
        .map_err(|_| format!("File not found: {}", path))?;

    if !path_obj.starts_with(&recordings_dir) {
        return Err("Refusing to delete a file outside the recordings directory".to_string());
    }

    tokio::fs::remove_file(&path_obj)
        .await
        .map_err(|e| format!("Failed to delete recording: {}", e))?;

    log::info!("Deleted recording: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn get_recording_path(id: String) -> Result<String, String> {
    let recordings_dir = get_recordings_dir();

    let mut entries = tokio::fs::read_dir(&recordings_dir)
        .await
        .map_err(|e| format!("Failed to read recordings directory: {}", e))?;

    // Filenames embed only the first 8 characters of the recording id (see
    // capture.rs::start_recording), so match against that exact fragment.
    let short_id = &id[..id.len().min(8)];
    let suffix = format!("_{}.mp4", short_id);

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Read dir error: {}", e))?
    {
        let filename = entry.file_name().to_string_lossy().to_string();
        if filename.ends_with(&suffix) {
            return Ok(entry.path().to_string_lossy().to_string());
        }
    }

    Err(format!("Recording file not found for id: {}", id))
}

#[tauri::command]
pub async fn open_recording_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let recordings_dir = get_recordings_dir();

    // Ensure directory exists
    tokio::fs::create_dir_all(&recordings_dir)
        .await
        .map_err(|e| format!("Failed to create recordings directory: {}", e))?;

    // Use tauri-plugin-shell to open the folder
    app_handle
        .shell()
        .open(&recordings_dir, None)
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(())
}
