import asyncio
import json
from app.config import YT_DLP_TIMEOUT
from app.security.sanitizer import sanitize_youtube_url


async def extract_audio_url(url: str) -> dict:
    """Extract best audio stream URL from YouTube using yt-dlp."""
    sanitized = sanitize_youtube_url(url)
    if not sanitized:
        raise ValueError("Invalid YouTube URL")

    args = ["yt-dlp", "--format", "bestaudio/best", "--no-playlist", "--dump-json", sanitized]

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=YT_DLP_TIMEOUT)

        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise ValueError(f"yt-dlp failed: {error_msg}")

        data = json.loads(stdout.decode())
        audio_url = data.get("url")
        title = data.get("title", "Unknown")

        if not audio_url:
            raise ValueError("No audio URL found in yt-dlp output")

        return {"audio_url": audio_url, "title": title}

    except asyncio.TimeoutError:
        raise TimeoutError("yt-dlp extraction timed out")
