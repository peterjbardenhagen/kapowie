use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub output_directory: String,
    pub max_concurrent_downloads: u32,
    pub default_quality: String,
    pub restream_default_port: u16,
    pub restream_default_protocol: String,
    pub auto_reconnect: bool,
    pub reconnect_attempts: u32,
    pub segment_duration_secs: f64,
}

impl Default for AppConfig {
    fn default() -> Self {
        let output_dir = dirs::download_dir()
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
            .join("Kapowie/Recordings");

        AppConfig {
            output_directory: output_dir.to_string_lossy().to_string(),
            max_concurrent_downloads: 3,
            default_quality: "best".to_string(),
            restream_default_port: 8080,
            restream_default_protocol: "HLS".to_string(),
            auto_reconnect: true,
            reconnect_attempts: 5,
            segment_duration_secs: 10.0,
        }
    }
}

impl AppConfig {
    pub fn load() -> Self {
        if let Some(config_path) = Self::config_path() {
            if config_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&config_path) {
                    if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                        return config;
                    }
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(config_path) = Self::config_path() {
            if let Some(parent) = config_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create config directory: {}", e))?;
            }
            let content = serde_json::to_string_pretty(self)
                .map_err(|e| format!("Failed to serialize config: {}", e))?;
            std::fs::write(&config_path, content)
                .map_err(|e| format!("Failed to write config: {}", e))?;
            Ok(())
        } else {
            Err("Could not determine config path".to_string())
        }
    }

    fn config_path() -> Option<std::path::PathBuf> {
        dirs::config_dir().map(|d| d.join("kapowie").join("config.json"))
    }
}
