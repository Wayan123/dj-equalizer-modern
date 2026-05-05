import asyncio
import json
from app.config import YT_DLP_TIMEOUT


async def search_youtube(query: str, max_results: int = 8) -> list[dict]:
    """Search YouTube by title using yt-dlp and return list of results."""
    query = query.strip()
    if len(query) < 2:
        raise ValueError("Query too short (min 2 characters)")

    max_results = max(1, min(int(max_results), 20))
    search_url = f"ytsearch{max_results}:{query}"
    args = [
        "yt-dlp",
        "--format", "bestaudio/best",
        "--no-playlist",
        "--dump-json",
        "--flat-playlist",
        search_url,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=YT_DLP_TIMEOUT)

        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise ValueError(f"yt-dlp search failed: {error_msg}")

        results = []
        for line in stdout.decode().strip().split("\n"):
            if not line:
                continue
            try:
                data = json.loads(line)
                video_id = data.get("id", "")
                title = data.get("title", "Unknown")
                duration = data.get("duration")
                channel = data.get("channel", data.get("uploader", ""))
                # Construct YouTube URL from video ID
                url = f"https://www.youtube.com/watch?v={video_id}" if video_id else ""
                if url:
                    results.append({
                        "title": title,
                        "url": url,
                        "duration": duration,
                        "channel": channel,
                        "id": video_id,
                    })
            except json.JSONDecodeError:
                continue

        return results[:max_results]

    except asyncio.TimeoutError:
        raise TimeoutError("YouTube search timed out")
