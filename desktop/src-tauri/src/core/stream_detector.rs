use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectedStream {
    pub url: String,
    pub stream_type: StreamType,
    pub quality_options: Vec<QualityOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum StreamType {
    HLS,
    DASH,
    RTMP,
    RTSP,
    Progressive,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QualityOption {
    pub label: String,
    pub bitrate: u64,
    pub resolution: Option<String>,
    pub url: String,
}

pub struct StreamDetector;

impl StreamDetector {
    pub fn new() -> Self {
        StreamDetector
    }

    pub fn detect_from_url(&self, url: &str) -> Vec<DetectedStream> {
        let mut streams = Vec::new();

        if url.contains(".m3u8") || url.contains("/hls/") {
            streams.push(DetectedStream {
                url: url.to_string(),
                stream_type: StreamType::HLS,
                quality_options: vec![
                    QualityOption {
                        label: "Auto".to_string(),
                        bitrate: 0,
                        resolution: None,
                        url: url.to_string(),
                    },
                    QualityOption {
                        label: "1080p".to_string(),
                        bitrate: 5_000_000,
                        resolution: Some("1920x1080".to_string()),
                        url: url.to_string(),
                    },
                    QualityOption {
                        label: "720p".to_string(),
                        bitrate: 2_500_000,
                        resolution: Some("1280x720".to_string()),
                        url: url.to_string(),
                    },
                    QualityOption {
                        label: "480p".to_string(),
                        bitrate: 1_000_000,
                        resolution: Some("854x480".to_string()),
                        url: url.to_string(),
                    },
                ],
            });
        } else if url.contains(".mpd") || url.contains("/dash/") {
            streams.push(DetectedStream {
                url: url.to_string(),
                stream_type: StreamType::DASH,
                quality_options: vec![],
            });
        } else if url.starts_with("rtmp://") {
            streams.push(DetectedStream {
                url: url.to_string(),
                stream_type: StreamType::RTMP,
                quality_options: vec![],
            });
        } else if url.starts_with("rtsp://") {
            streams.push(DetectedStream {
                url: url.to_string(),
                stream_type: StreamType::RTSP,
                quality_options: vec![],
            });
        } else {
            streams.push(DetectedStream {
                url: url.to_string(),
                stream_type: StreamType::Unknown,
                quality_options: vec![],
            });
        }

        streams
    }

    pub async fn probe_stream(&self, url: &str) -> Result<DetectedStream, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to probe stream: {}", e))?;

        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let stream_type = if content_type.contains("mpegurl") || content_type.contains("x-mpegurl") {
            StreamType::HLS
        } else if content_type.contains("dash") {
            StreamType::DASH
        } else if content_type.contains("flv") {
            StreamType::RTMP
        } else {
            StreamType::Progressive
        };

        Ok(DetectedStream {
            url: url.to_string(),
            stream_type,
            quality_options: vec![],
        })
    }
}
