use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReStreamStatus {
    pub id: String,
    pub url: String,
    pub protocol: String,
    pub port: u16,
    pub path: String,
    pub status: String,
    pub started_at: Option<String>,
    pub viewer_count: u32,
}

type ActiveRestreams = Arc<Mutex<HashMap<String, ReStreamStatus>>>;

#[tauri::command]
pub async fn start_restream(
    stream_url: String,
    protocol: String,
    port: u16,
    path: String,
    state: tauri::State<'_, ActiveRestreamsState>,
) -> Result<ReStreamStatus, String> {
    if stream_url.is_empty() {
        return Err("Stream URL cannot be empty".to_string());
    }

    if !(1024..=65535).contains(&port) {
        return Err("Port must be between 1024 and 65535".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();

    let status = ReStreamStatus {
        id: id.clone(),
        url: stream_url.clone(),
        protocol: protocol.clone(),
        port,
        path: path.clone(),
        status: "starting".to_string(),
        started_at: Some(chrono::Local::now().to_rfc3339()),
        viewer_count: 0,
    };

    log::info!(
        "Starting re-stream: {} via {} at port {}",
        stream_url,
        protocol,
        port
    );

    let mut restreams = state.0.lock().await;
    let mut status = status.clone();
    status.status = "active".to_string();
    restreams.insert(id.clone(), status.clone());

    Ok(status)
}

#[tauri::command]
pub async fn stop_restream(
    id: String,
    state: tauri::State<'_, ActiveRestreamsState>,
) -> Result<ReStreamStatus, String> {
    let mut restreams = state.0.lock().await;

    if let Some(mut restream) = restreams.remove(&id) {
        restream.status = "stopped".to_string();
        log::info!("Stopped re-stream: {}", id);
        Ok(restream)
    } else {
        Err(format!("Re-stream not found: {}", id))
    }
}

#[tauri::command]
pub async fn get_restream_status(
    state: tauri::State<'_, ActiveRestreamsState>,
) -> Result<Vec<ReStreamStatus>, String> {
    let restreams = state.0.lock().await;
    let list: Vec<ReStreamStatus> = restreams.values().cloned().collect();
    Ok(list)
}

pub struct ActiveRestreamsState(pub ActiveRestreams);
