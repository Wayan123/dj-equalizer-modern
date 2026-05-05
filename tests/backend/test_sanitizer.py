import pytest
from app.security.sanitizer import sanitize_stream_url, sanitize_youtube_url


def test_valid_standard_url():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert sanitize_youtube_url(url) == url


def test_valid_short_url():
    url = "https://youtu.be/abc123"
    assert sanitize_youtube_url(url) == url


def test_valid_url_without_scheme_is_normalized():
    assert sanitize_youtube_url("youtu.be/abc123") == "https://youtu.be/abc123"


def test_valid_url_with_share_params():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=share-token"
    assert sanitize_youtube_url(url) == url


def test_invalid_url():
    assert sanitize_youtube_url("not a url") is None


def test_non_youtube_domain():
    assert sanitize_youtube_url("https://vimeo.com/123") is None


def test_empty_string():
    assert sanitize_youtube_url("") is None


def test_none_input():
    assert sanitize_youtube_url(None) is None


def test_trim_whitespace():
    url = "  https://youtu.be/abc123  "
    assert sanitize_youtube_url(url) == url.strip()


def test_reject_youtube_lookalike_domain():
    assert sanitize_youtube_url("https://youtube.com.evil.test/watch?v=abc123") is None


def test_valid_googlevideo_stream_url():
    url = "https://rr1---sn-abcd.googlevideo.com/videoplayback?id=abc123"
    assert sanitize_stream_url(url) == url


def test_reject_stream_to_localhost():
    assert sanitize_stream_url("http://127.0.0.1:8800/admin") is None


def test_reject_stream_to_untrusted_host():
    assert sanitize_stream_url("https://example.com/audio.mp4") is None
