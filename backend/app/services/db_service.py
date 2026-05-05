import sqlite3
import os
from datetime import datetime

DB_PATH = os.getenv("DJ_EQ_DB_PATH", "/tmp/dj-eq-playlist.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS playlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            url TEXT NOT NULL,
            cdn_url TEXT DEFAULT '',
            channel TEXT DEFAULT '',
            duration INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(video_id)
        )
    """)
    conn.commit()
    conn.close()


def add_playlist_entry(video_id: str, title: str, url: str, cdn_url: str = "", channel: str = "", duration: int = 0) -> dict:
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO playlist (video_id, title, url, cdn_url, channel, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (video_id, title, url, cdn_url, channel, duration, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM playlist WHERE video_id = ?", (video_id,)).fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def get_playlist() -> list[dict]:
    conn = _get_conn()
    try:
        rows = conn.execute("SELECT * FROM playlist ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_playlist_entry(video_id: str) -> bool:
    conn = _get_conn()
    try:
        cursor = conn.execute("DELETE FROM playlist WHERE video_id = ?", (video_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def clear_playlist() -> int:
    conn = _get_conn()
    try:
        cursor = conn.execute("DELETE FROM playlist")
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def update_cdn_url(video_id: str, cdn_url: str) -> bool:
    conn = _get_conn()
    try:
        cursor = conn.execute("UPDATE playlist SET cdn_url = ? WHERE video_id = ?", (cdn_url, video_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()
