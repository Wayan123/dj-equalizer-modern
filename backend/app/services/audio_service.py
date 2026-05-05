import os
import re
import aiofiles
from app.config import UPLOAD_DIR


ALLOWED_EXTENSIONS = {"mp3", "wav", "ogg", "flac", "aac", "m4a", "webm", "mp4", "mkv", "avi", "mov", "flv", "3gp", "amr"}


def sanitize_filename(name: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    return clean[:255]


async def validate_and_save_upload(filename: str | None, contents: bytes) -> str:
    if not filename:
        raise ValueError("No filename provided")

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Invalid file extension: .{ext}")

    safe_name = sanitize_filename(filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)

    return filepath
