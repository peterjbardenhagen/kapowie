use serde::{Deserialize, Serialize};
use tauri::State;

use crate::RecordingsState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamInfo {
    pub url: String,
    pub format: String,
    pub quality: String,
    pub bitrate: Option<u64>,
    pub duration: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingState {
    pub id: String,
    pub url: String,
    pub output_path: String,
    pub status: String,
    pub started_at: String,
    pub file_size: u64,
    pub duration_secs: f64,
}

#[tauri::command]
pub async fn get_stream_info(url: String) -> Result<StreamInfo, String> {
    if url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    log::info!("Getting stream info for: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = match client.head(&url).send().await {
        Ok(resp) => resp,
        Err(_) => client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch stream: {}", e))?,
    };

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let format = if content_type.contains("mpegurl") || content_type.contains("x-mpegurl") {
        "HLS".to_string()
    } else if content_type.contains("mp2t") || content_type.contains("video/mp2t") {
        "TS".to_string()
    } else if content_type.contains("flv") {
        "FLV".to_string()
    } else if content_type.contains("mp4") || content_type.contains("video/mp4") {
        "MP4".to_string()
    } else {
        "Unknown".to_string()
    };

    Ok(StreamInfo {
        url,
        format,
        quality: "auto".to_string(),
        bitrate: None,
        duration: None,
    })
}

#[tauri::command]
pub async fn start_recording(
    url: String,
    output_dir: String,
    quality: String,
    recordings: State<'_, RecordingsState>,
) -> Result<RecordingState, String> {
    if url.is_empty() {
        return Err("Stream URL cannot be empty".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let sanitized_name = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("{}_{}.mp4", sanitized_name, &id[..8]);
    let output_path = if output_dir.is_empty() {
        format!("/tmp/{}", filename)
    } else {
        format!("{}/{}", output_dir.trim_end_matches('/'), filename)
    };

    log::info!(
        "Starting recording: {} -> {} (quality: {})",
        url,
        output_path,
        quality
    );

    let recording = RecordingState {
        id: id.clone(),
        url: url.clone(),
        output_path: output_path.clone(),
        status: "recording".to_string(),
        started_at: chrono::Local::now().to_rfc3339(),
        file_size: 0,
        duration_secs: 0.0,
    };

    recordings.0.lock().await.insert(id.clone(), recording.clone());

    Ok(recording)
}

#[tauri::command]
pub async fn stop_recording(
    id: String,
    recordings: State<'_, RecordingsState>,
) -> Result<RecordingState, String> {
    let mut recs = recordings.0.lock().await;

    if let Some(mut recording) = recs.remove(&id) {
        recording.status = "completed".to_string();
        log::info!("Stopped recording: {}", id);
        Ok(recording)
    } else {
        Err(format!("Recording not found: {}", id))
    }
}

#[tauri::command]
pub async fn list_recordings(
    recordings: State<'_, RecordingsState>,
) -> Result<Vec<RecordingState>, String> {
    let recs = recordings.0.lock().await;
    let list: Vec<RecordingState> = recs.values().cloned().collect();
    Ok(list)
}
