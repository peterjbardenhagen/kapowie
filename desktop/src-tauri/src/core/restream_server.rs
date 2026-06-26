use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReStreamServerConfig {
    pub bind_addr: SocketAddr,
    pub stream_source_url: String,
    pub protocol: ReStreamProtocol,
    pub max_connections: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ReStreamProtocol {
    HLS,
    RTSP,
    MPEGTS,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReStreamServerStatus {
    pub running: bool,
    pub uptime_seconds: u64,
    pub bytes_sent: u64,
    pub active_connections: u32,
    pub url: String,
}

pub struct ReStreamServer {
    config: Option<ReStreamServerConfig>,
    start_time: Option<std::time::Instant>,
}

impl ReStreamServer {
    pub fn new() -> Self {
        ReStreamServer {
            config: None,
            start_time: None,
        }
    }

    pub fn configure(&mut self, config: ReStreamServerConfig) {
        self.config = Some(config);
    }

    pub async fn start(&mut self) -> Result<(), String> {
        let config = self.config.as_ref().ok_or("Server not configured")?;

        if config.bind_addr.port() < 1024 {
            return Err("Cannot bind to privileged port without root".to_string());
        }

        self.start_time = Some(std::time::Instant::now());
        log::info!(
            "Re-stream server started on {} serving {}",
            config.bind_addr,
            config.stream_source_url
        );
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<(), String> {
        self.start_time = None;
        log::info!("Re-stream server stopped");
        Ok(())
    }

    pub fn get_status(&self) -> ReStreamServerStatus {
        let uptime = self
            .start_time
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);

        ReStreamServerStatus {
            running: self.start_time.is_some(),
            uptime_seconds: uptime,
            bytes_sent: 0,
            active_connections: 0,
            url: self
                .config
                .as_ref()
                .map(|c| format!("{}://{}{}", c.protocol.short_name(), c.bind_addr, "/stream"))
                .unwrap_or_default(),
        }
    }
}

impl ReStreamProtocol {
    pub fn short_name(&self) -> &str {
        match self {
            ReStreamProtocol::HLS => "hls",
            ReStreamProtocol::RTSP => "rtsp",
            ReStreamProtocol::MPEGTS => "mpegts",
        }
    }
}
