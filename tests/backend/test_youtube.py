import pytest
from app.services.yt_service import extract_audio_url


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
