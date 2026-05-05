import ipaddress
import re
from urllib.parse import parse_qs, urlparse

YOUTUBE_VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{6,}$")

YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}

STREAM_HOST_SUFFIXES = (
    "googlevideo.com",
    "youtube.com",
    "youtube-nocookie.com",
)


def _normalize_url(url: str | None) -> str | None:
    if not isinstance(url, str):
        return None

    clean = url.strip()
    if not clean:
        return None

    if not re.match(r"^https?://", clean, flags=re.IGNORECASE):
        clean = f"https://{clean}"

    return clean


def _host_matches_suffix(hostname: str, suffix: str) -> bool:
    return hostname == suffix or hostname.endswith(f".{suffix}")


def _is_public_hostname(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return True

    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def sanitize_youtube_url(url: str | None) -> str | None:
    """Validate a YouTube watch/embed/share URL and return a normalized URL."""
    normalized = _normalize_url(url)
    if not normalized:
        return None

    try:
        parsed = urlparse(normalized)
    except Exception:
        return None

    hostname = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or hostname not in YOUTUBE_HOSTS:
        return None

    if hostname == "youtu.be":
        video_id = parsed.path.lstrip("/").split("/", 1)[0]
        return normalized if YOUTUBE_VIDEO_ID_PATTERN.match(video_id) else None

    if parsed.path == "/watch":
        video_id = parse_qs(parsed.query).get("v", [""])[0]
        return normalized if YOUTUBE_VIDEO_ID_PATTERN.match(video_id) else None

    if parsed.path.startswith("/embed/") or parsed.path.startswith("/shorts/") or parsed.path.startswith("/live/"):
        video_id = parsed.path.split("/", 2)[2].split("/", 1)[0]
        return normalized if YOUTUBE_VIDEO_ID_PATTERN.match(video_id) else None

    return None


def sanitize_stream_url(url: str | None) -> str | None:
    """Validate media stream URLs returned by yt-dlp before proxying/downloading."""
    normalized = _normalize_url(url)
    if not normalized:
        return None

    try:
        parsed = urlparse(normalized)
    except Exception:
        return None

    hostname = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not hostname or not _is_public_hostname(hostname):
        return None

    if not any(_host_matches_suffix(hostname, suffix) for suffix in STREAM_HOST_SUFFIXES):
        return None

    return normalized
