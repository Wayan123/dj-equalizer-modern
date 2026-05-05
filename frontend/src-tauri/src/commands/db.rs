use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistEntry {
    pub id: i64,
    pub video_id: String,
    pub title: String,
    pub url: String,
    pub cdn_url: String,
    pub channel: String,
    pub duration: i64,
    pub created_at: String,
}

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS playlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL DEFAULT '',
                url TEXT NOT NULL,
                cdn_url TEXT DEFAULT '',
                channel TEXT DEFAULT '',
                duration INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )",
            [],
        )?;
        Ok(Db { conn })
    }

    pub fn list(&self) -> Vec<PlaylistEntry> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, video_id, title, url, cdn_url, channel, duration, created_at FROM playlist ORDER BY created_at DESC")
            .ok();
        match &mut stmt {
            Some(s) => s.query_map([], |row| {
                Ok(PlaylistEntry {
                    id: row.get(0)?,
                    video_id: row.get(1)?,
                    title: row.get(2)?,
                    url: row.get(3)?,
                    cdn_url: row.get(4)?,
                    channel: row.get(5)?,
                    duration: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .ok()
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default(),
            None => vec![],
        }
    }

    pub fn add(
        &self,
        video_id: &str,
        title: &str,
        url: &str,
        cdn_url: &str,
        channel: &str,
        duration: i64,
    ) -> Result<PlaylistEntry> {
        let now = chrono_now();
        self.conn.execute(
            "INSERT OR REPLACE INTO playlist (video_id, title, url, cdn_url, channel, duration, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![video_id, title, url, cdn_url, channel, duration, now],
        )?;
        let mut stmt = self.conn.prepare(
            "SELECT id, video_id, title, url, cdn_url, channel, duration, created_at FROM playlist WHERE video_id = ?1",
        )?;
        stmt.query_row(params![video_id], |row| {
            Ok(PlaylistEntry {
                id: row.get(0)?,
                video_id: row.get(1)?,
                title: row.get(2)?,
                url: row.get(3)?,
                cdn_url: row.get(4)?,
                channel: row.get(5)?,
                duration: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
    }

    pub fn delete(&self, video_id: &str) -> bool {
        self.conn
            .execute("DELETE FROM playlist WHERE video_id = ?1", params![video_id])
            .map(|n| n > 0)
            .unwrap_or(false)
    }

    pub fn clear(&self) -> i64 {
        self.conn
            .execute("DELETE FROM playlist", [])
            .map(|n| n as i64)
            .unwrap_or(0)
    }

    pub fn update_cdn(&self, video_id: &str, cdn_url: &str) -> bool {
        self.conn
            .execute(
                "UPDATE playlist SET cdn_url = ?1 WHERE video_id = ?2",
                params![cdn_url, video_id],
            )
            .map(|n| n > 0)
            .unwrap_or(false)
    }
}

fn chrono_now() -> String {
    Utc::now().to_rfc3339()
}

// Tauri managed state wrapper
pub struct DbState(pub Mutex<Db>);
