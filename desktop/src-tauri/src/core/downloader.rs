use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub id: String,
    pub url: String,
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: f64,
    pub eta_seconds: Option<f64>,
    pub status: DownloadStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Paused,
    Completed,
    Failed(String),
}

pub struct Downloader;

impl Downloader {
    pub fn new() -> Self {
        Downloader
    }

    pub async fn download_to_file(
        &self,
        url: &str,
        output_path: &str,
        progress_callback: impl Fn(DownloadProgress),
    ) -> Result<u64, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to start download: {}", e))?;

        let total_size = response.content_length();
        let path = Path::new(output_path);

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create output directory: {}", e))?;
        }

        let mut file = File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let start_time = std::time::Instant::now();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
            file.write_all(&chunk)
                .map_err(|e| format!("Write error: {}", e))?;

            downloaded += chunk.len() as u64;
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                downloaded as f64 / elapsed
            } else {
                0.0
            };

            let eta = total_size.map(|total| {
                if downloaded > 0 && speed > 0.0 {
                    (total - downloaded) as f64 / speed
                } else {
                    0.0
                }
            });

            progress_callback(DownloadProgress {
                id: uuid::Uuid::new_v4().to_string(),
                url: url.to_string(),
                bytes_downloaded: downloaded,
                total_bytes: total_size,
                speed_bytes_per_sec: speed,
                eta_seconds: eta,
                status: DownloadStatus::Downloading,
            });
        }

        file.flush().map_err(|e| format!("Flush error: {}", e))?;
        Ok(downloaded)
    }
}
