use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReStreamConfig {
    pub stream_url: String,
    pub protocol: String,
    pub port: u16,
    pub path: String,
    pub status: Option<String>,
}

type ActiveRecordings = Arc<Mutex<HashMap<String, RecordingState>>>;
type ActiveRestreams = Arc<Mutex<HashMap<String, ReStreamConfig>>>;

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

    let response = client
        .head(&url)
        .send()
        .await
        .or_else(|_| client.get(&url).send().await)
        .map_err(|e| format!("Failed to fetch stream: {}", e))?;

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let format = match content_type.as_str() {
        ct if ct.contains("mpegurl") || ct.contains("x-mpegurl") => "HLS".to_string(),
        ct if ct.contains("mp2t") || ct.contains("video/mp2t") => "TS".to_string(),
        ct if ct.contains("flv") => "FLV".to_string(),
        ct if ct.contains("mp4") || ct.contains("video/mp4") => "MP4".to_string(),
        _ => "Unknown".to_string(),
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
    state: tauri::State<'_, ActiveRecordingsState>,
) -> Result<RecordingState, String> {
    if url.is_empty() {
        return Err("Stream URL cannot be empty".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let sanitized_name = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("{}_{}.mp4", sanitized_name, &id[..8]);
    let output_path = format!("{}/{}", output_dir.trim_end_matches('/'), filename);

    log::info!("Starting recording: {} -> {}", url, output_path);

    let recording = RecordingState {
        id: id.clone(),
        url: url.clone(),
        output_path: output_path.clone(),
        status: "recording".to_string(),
        started_at: chrono::Local::now().to_rfc3339(),
        file_size: 0,
        duration_secs: 0.0,
    };

    state.0.lock().await.insert(id.clone(), recording.clone());

    Ok(recording)
}

#[tauri::command]
pub async fn stop_recording(
    id: String,
    state: tauri::State<'_, ActiveRecordingsState>,
) -> Result<RecordingState, String> {
    let mut recordings = state.0.lock().await;

    if let Some(mut recording) = recordings.remove(&id) {
        recording.status = "completed".to_string();
        recording.duration_secs = 0.0;
        log::info!("Stopped recording: {}", id);
        Ok(recording)
    } else {
        Err(format!("Recording not found: {}", id))
    }
}

#[tauri::command]
pub async fn list_recordings(
    state: tauri::State<'_, ActiveRecordingsState>,
) -> Result<Vec<RecordingState>, String> {
    let recordings = state.0.lock().await;
    let list: Vec<RecordingState> = recordings.values().cloned().collect();
    Ok(list)
}

pub struct ActiveRecordingsState(pub ActiveRecordings);
