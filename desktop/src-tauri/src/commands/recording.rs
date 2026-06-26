use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::Manager;

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
    let dir = dirs::download_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
        .join("Kapowie/Recordings");
    dir.to_string_lossy().to_string()
}

#[tauri::command]
pub async fn delete_recording(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(format!("File not found: {}", path));
    }

    tokio::fs::remove_file(&path)
        .await
        .map_err(|e| format!("Failed to delete recording: {}", e))?;

    log::info!("Deleted recording: {}", path);
    Ok(())
}

#[tauri::command]
pub async fn get_recording_path(id: String) -> Result<String, String> {
    let recordings_dir = get_recordings_dir();

    let entries = tokio::fs::read_dir(&recordings_dir)
        .await
        .map_err(|e| format!("Failed to read recordings directory: {}", e))?;

    let mut entries = tokio::fs::ReadDir::from(entries);
    while let Some(entry) = entries.next_entry().await.ok().flatten() {
        let filename = entry.file_name().to_string_lossy().to_string();
        if filename.contains(&id) {
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

    #[cfg(target_os = "windows")]
    {
        tauri_plugin_shell::open_path_with_command(
            app_handle,
            &recordings_dir,
            None::<&str>,
        )
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        tauri_plugin_shell::open_path_with_command(
            app_handle,
            &recordings_dir,
            Some("xdg-open"),
        )
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
