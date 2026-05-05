use serde_json::Value;
use std::fs;

pub fn presets_path() -> String {
    let base = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("dj-eq-modern")
        .join("presets");
    fs::create_dir_all(&base).ok();
    base.to_string_lossy().to_string()
}

#[tauri::command]
pub fn preset_save(name: String, data: String) -> Result<(), String> {
    let dir = presets_path();
    // Sanitize filename: only alphanumeric, dash, underscore
    let safe_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let path = std::path::Path::new(&dir).join(format!("{}.json", safe_name));
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preset_load_all() -> Result<std::collections::HashMap<String, Value>, String> {
    let dir = presets_path();
    let mut presets = std::collections::HashMap::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "json") {
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let content = fs::read_to_string(&path).unwrap_or_default();
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                presets.insert(stem, val);
            }
        }
    }
    Ok(presets)
}

#[tauri::command]
pub fn preset_delete(name: String) -> Result<(), String> {
    let dir = presets_path();
    let safe_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let path = std::path::Path::new(&dir).join(format!("{}.json", safe_name));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}
