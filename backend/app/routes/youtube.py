import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.services.yt_service import extract_audio_url
from app.services.yt_search import search_youtube
from app.security.sanitizer import sanitize_stream_url, sanitize_youtube_url
from app.security.rate_limit import limiter

router = APIRouter()


class YouTubeRequest(BaseModel):
    url: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=120)
    max_results: int = Field(8, ge=1, le=20)


@router.post("/extract")
@limiter.limit("5/minute")
async def extract_youtube(request: Request, body: YouTubeRequest):
    sanitized = sanitize_youtube_url(body.url)
    if not sanitized:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        result = await extract_audio_url(sanitized)
        return result
    except TimeoutError:
        raise HTTPException(status_code=408, detail="YouTube extraction timed out")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.get("/stream")
@limiter.limit("10/minute")
async def stream_youtube(request: Request, url: str):
    """Proxy-stream audio from YouTube CDN to bypass browser CORS/media-source restrictions."""
    stream_url = sanitize_stream_url(url)
    if not stream_url:
        raise HTTPException(status_code=400, detail="Invalid stream URL")

    async def audio_generator():
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            async with client.stream("GET", stream_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "*/*",
            }) as resp:
                if resp.status_code != 200:
                    raise HTTPException(status_code=502, detail=f"Upstream returned {resp.status_code}")
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk

    return StreamingResponse(
        audio_generator(),
        media_type="audio/mp4",
        headers={
            "Content-Type": "audio/mp4",
            "Cache-Control": "no-cache",
            "Accept-Ranges": "bytes",
        },
    )


@router.post("/search")
@limiter.limit("3/minute")
async def search_youtube_endpoint(request: Request, body: SearchRequest):
    """Search YouTube by song title and return list of matching videos."""
    query = body.query.strip()
    if not query or len(query) < 2:
        raise HTTPException(status_code=400, detail="Query too short (min 2 characters)")

    try:
        results = await search_youtube(query, body.max_results)
        return {"results": results}
    except TimeoutError:
        raise HTTPException(status_code=408, detail="YouTube search timed out")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
