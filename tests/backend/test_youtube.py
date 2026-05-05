import asyncio
import json
import pytest
from app.services.yt_service import extract_audio_url
from app.services.yt_search import search_youtube


class FakeProcess:
    def __init__(self, stdout: bytes, stderr: bytes = b"", returncode: int = 0):
        self._stdout = stdout
        self._stderr = stderr
        self.returncode = returncode

    async def communicate(self):
        return self._stdout, self._stderr


@pytest.mark.asyncio
async def test_extract_invalid_url():
    """Should raise ValueError for invalid URL."""
    with pytest.raises(ValueError):
        await extract_audio_url("not_a_youtube_url")


@pytest.mark.asyncio
@pytest.mark.integration
async def test_extract_nonexistent_video():
    """Should raise error for non-existent video ID."""
    with pytest.raises(Exception):
        await extract_audio_url("https://www.youtube.com/watch?v=ZZZZZZZZZZZ")


@pytest.mark.asyncio
async def test_search_falls_back_to_uploader_when_channel_is_null(monkeypatch):
    payload = json.dumps(
        {
            "id": "abc123",
            "title": None,
            "duration": 123,
            "channel": None,
            "uploader": "Fallback Channel",
        }
    )
    fake_proc = FakeProcess(payload.encode("utf-8"))

    async def fake_create_subprocess_exec(*args, **kwargs):
        return fake_proc

    async def fake_wait_for(awaitable, timeout):
        return await awaitable

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)
    monkeypatch.setattr(asyncio, "wait_for", fake_wait_for)

    results = await search_youtube("lofi test", max_results=1)

    assert results == [
        {
            "title": "Unknown",
            "url": "https://www.youtube.com/watch?v=abc123",
            "duration": 123,
            "channel": "Fallback Channel",
            "id": "abc123",
        }
    ]
