use crate::commands::db::{DbState, PlaylistEntry};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct AddEntry {
    pub video_id: String,
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub cdn_url: String,
    #[serde(default)]
    pub channel: String,
    #[serde(default)]
    pub duration: i64,
}

#[tauri::command]
pub fn playlist_list(db: State<'_, DbState>) -> Vec<PlaylistEntry> {
    let db = db.0.lock().unwrap();
    db.list()
}

#[tauri::command]
pub fn playlist_add(entry: AddEntry, db: State<'_, DbState>) -> Result<PlaylistEntry, String> {
    if entry.video_id.is_empty() || entry.url.is_empty() {
        return Err("video_id and url are required".into());
    }
    let db = db.0.lock().unwrap();
    db.add(
        &entry.video_id,
        &entry.title,
        &entry.url,
        &entry.cdn_url,
        &entry.channel,
        entry.duration,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn playlist_delete(video_id: String, db: State<'_, DbState>) -> Result<String, String> {
    let db = db.0.lock().unwrap();
    if db.delete(&video_id) {
        Ok(video_id)
    } else {
        Err("Entry not found".into())
    }
}

#[tauri::command]
pub fn playlist_clear(db: State<'_, DbState>) -> Result<i64, String> {
    let db = db.0.lock().unwrap();
    Ok(db.clear())
}

#[tauri::command]
pub fn playlist_update_cdn(
    video_id: String,
    cdn_url: String,
    db: State<'_, DbState>,
) -> Result<String, String> {
    let db = db.0.lock().unwrap();
    if db.update_cdn(&video_id, &cdn_url) {
        Ok(video_id)
    } else {
        Err("Entry not found".into())
    }
}
