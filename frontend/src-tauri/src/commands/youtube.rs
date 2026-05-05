use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;
use url::Url;

const MAX_SEARCH_RESULTS: u32 = 20;
const MAX_SEARCH_QUERY_CHARS: usize = 120;
const MAX_AUDIO_DOWNLOAD_BYTES: u64 = 100 * 1024 * 1024;
const YT_DLP_TIMEOUT_SECS: u64 = 30;
const STREAM_HOST_SUFFIXES: [&str; 3] = ["googlevideo.com", "youtube.com", "youtube-nocookie.com"];

fn content_type_to_extension(content_type: Option<&str>) -> &'static str {
    let media_type = content_type
        .and_then(|value| value.split(';').next())
        .map(|value| value.trim().to_ascii_lowercase());

    match media_type.as_deref() {
        Some("audio/webm") | Some("video/webm") => "webm",
        Some("audio/ogg") | Some("application/ogg") => "ogg",
        Some("audio/flac") => "flac",
        Some("audio/aac") => "aac",
        Some("audio/mpeg") => "mp3",
        Some("audio/wav") | Some("audio/x-wav") => "wav",
        Some("audio/amr") => "amr",
        Some("audio/3gpp") => "3gp",
        Some("audio/x-m4a") | Some("audio/mp4") | Some("video/mp4") => "m4a",
        Some("video/x-matroska") => "mkv",
        Some("video/quicktime") => "mov",
        _ => "mp4",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractResult {
    pub audio_url: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: Option<i64>,
    pub channel: String,
}

/// Validate YouTube URL format
fn normalize_youtube_url(input: &str) -> Result<String, String> {
    let clean = input.trim();
    if clean.is_empty() {
        return Err("Invalid YouTube URL".into());
    }

    let normalized = if clean.starts_with("http://") || clean.starts_with("https://") {
        clean.to_string()
    } else {
        format!("https://{}", clean)
    };

    let parsed = Url::parse(&normalized).map_err(|_| "Invalid YouTube URL".to_string())?;
    let host = parsed
        .host_str()
        .map(|h| h.to_ascii_lowercase())
        .ok_or_else(|| "Invalid YouTube URL".to_string())?;

    let allowed_host = matches!(
        host.as_str(),
        "youtube.com" | "www.youtube.com" | "m.youtube.com" | "music.youtube.com" | "youtu.be"
    );
    if !allowed_host {
        return Err("Invalid YouTube URL".into());
    }

    let video_id_re = regex::Regex::new(r"^[A-Za-z0-9_-]{6,}$").unwrap();
    let video_id = if host == "youtu.be" {
        parsed
            .path()
            .trim_start_matches('/')
            .split('/')
            .next()
            .unwrap_or("")
            .to_string()
    } else if parsed.path() == "/watch" {
        parsed
            .query_pairs()
            .find(|(key, _)| key == "v")
            .map(|(_, value)| value.into_owned())
            .unwrap_or_default()
    } else if parsed.path().starts_with("/embed/")
        || parsed.path().starts_with("/shorts/")
        || parsed.path().starts_with("/live/")
    {
        parsed.path().split('/').nth(2).unwrap_or("").to_string()
    } else {
        String::new()
    };

    if !video_id_re.is_match(&video_id) {
        return Err("Invalid YouTube URL".into());
    }

    Ok(normalized)
}

fn host_matches_suffix(host: &str, suffix: &str) -> bool {
    host == suffix || host.ends_with(&format!(".{}", suffix))
}

fn validate_stream_url(input: &str) -> Result<Url, String> {
    let parsed = Url::parse(input.trim()).map_err(|_| "Invalid URL".to_string())?;
    if parsed.scheme() != "https" || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Invalid URL".into());
    }

    let host = parsed
        .host_str()
        .map(|h| h.to_ascii_lowercase())
        .ok_or_else(|| "Invalid URL".to_string())?;
    if !STREAM_HOST_SUFFIXES
        .iter()
        .any(|suffix| host_matches_suffix(&host, suffix))
    {
        return Err("Unsupported media host".into());
    }

    Ok(parsed)
}

#[tauri::command]
pub async fn youtube_extract(url: String) -> Result<ExtractResult, String> {
    let sanitized = normalize_youtube_url(&url)?;

    let output = timeout(
        Duration::from_secs(YT_DLP_TIMEOUT_SECS),
        Command::new("yt-dlp")
            .args([
                "--format",
                "bestaudio/best",
                "--no-playlist",
                "--dump-json",
                &sanitized,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output(),
    )
    .await
    .map_err(|_| "yt-dlp extraction timed out".to_string())?
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp failed: {}", err.trim()));
    }

    let data: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    let audio_url = data["url"]
        .as_str()
        .ok_or("No audio URL found")?
        .to_string();

    let title = data["title"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    Ok(ExtractResult { audio_url, title })
}

#[tauri::command]
pub async fn youtube_search(query: String, max_results: u32) -> Result<Vec<SearchResult>, String> {
    let query = query.trim();
    if query.len() < 2 {
        return Err("Query too short (min 2 characters)".into());
    }
    if query.chars().count() > MAX_SEARCH_QUERY_CHARS {
        return Err("Query too long (max 120 characters)".into());
    }

    let max_results = max_results.clamp(1, MAX_SEARCH_RESULTS);
    let search_url = format!("ytsearch{}:{}", max_results, query);

    let output = timeout(
        Duration::from_secs(YT_DLP_TIMEOUT_SECS),
        Command::new("yt-dlp")
            .args([
                "--format",
                "bestaudio/best",
                "--no-playlist",
                "--dump-json",
                "--flat-playlist",
                &search_url,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output(),
    )
    .await
    .map_err(|_| "yt-dlp search timed out".to_string())?
    .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp search failed: {}", err.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(line) {
            let video_id = data["id"].as_str().unwrap_or("").to_string();
            if video_id.is_empty() {
                continue;
            }
            results.push(SearchResult {
                id: video_id.clone(),
                title: data["title"].as_str().unwrap_or("Unknown").to_string(),
                url: format!("https://www.youtube.com/watch?v={}", video_id),
                duration: data["duration"].as_i64(),
                channel: data["channel"]
                    .as_str()
                    .or(data["uploader"].as_str())
                    .unwrap_or("")
                    .to_string(),
            });
        }
    }

    results.truncate(max_results as usize);
    Ok(results)
}

/// Download audio to a temp file and return the local path
/// This is used by Tauri to serve audio via the asset protocol
#[tauri::command]
pub async fn download_audio(url: String) -> Result<String, String> {
    let stream_url = validate_stream_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    let mut resp = client
        .get(stream_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Upstream returned {}", resp.status()));
    }

    validate_stream_url(resp.url().as_str())?;

    if let Some(content_length) = resp.content_length() {
        if content_length > MAX_AUDIO_DOWNLOAD_BYTES {
            return Err("Audio stream is too large".into());
        }
    }

    // Create temp directory if needed
    let tmp_dir = std::env::temp_dir().join("dj-eq-audio");
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| format!("Temp directory failed: {}", e))?;

    // Generate unique filename
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    let extension = content_type_to_extension(content_type);

    let filename = format!(
        "audio_{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        extension
    );
    let path = tmp_dir.join(&filename);

    let mut file = File::create(&path)
        .await
        .map_err(|e| format!("Write failed: {}", e))?;

    let mut downloaded: u64 = 0;
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Read failed: {}", e))?
    {
        downloaded += chunk.len() as u64;
        if downloaded > MAX_AUDIO_DOWNLOAD_BYTES {
            let _ = tokio::fs::remove_file(&path).await;
            return Err("Audio stream is too large".into());
        }
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write failed: {}", e))?;
    }
    file.flush()
        .await
        .map_err(|e| format!("Write failed: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::content_type_to_extension;

    #[test]
    fn maps_webm_streams_to_webm_extension() {
        assert_eq!(content_type_to_extension(Some("audio/webm; codecs=opus")), "webm");
    }

    #[test]
    fn maps_mp4_audio_streams_to_m4a_extension() {
        assert_eq!(content_type_to_extension(Some("audio/mp4")), "m4a");
    }

    #[test]
    fn falls_back_to_mp4_when_content_type_is_unknown() {
        assert_eq!(content_type_to_extension(None), "mp4");
    }
}
