from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.db_service import (
    add_playlist_entry,
    get_playlist,
    delete_playlist_entry,
    clear_playlist,
    update_cdn_url,
)

router = APIRouter()


class PlaylistAddRequest(BaseModel):
    video_id: str
    title: str = ""
    url: str
    cdn_url: str = ""
    channel: str = ""
    duration: int = 0


class CdnUpdateRequest(BaseModel):
    cdn_url: str


@router.get("/list")
async def list_playlist():
    """Get all playlist entries from database."""
    return {"entries": get_playlist()}


@router.post("/add")
async def add_to_playlist(body: PlaylistAddRequest):
    """Add or update a playlist entry."""
    if not body.video_id or not body.url:
        raise HTTPException(status_code=400, detail="video_id and url are required")
    entry = add_playlist_entry(
        video_id=body.video_id,
        title=body.title,
        url=body.url,
        cdn_url=body.cdn_url,
        channel=body.channel,
        duration=body.duration,
    )
    return {"entry": entry}


@router.delete("/delete/{video_id}")
async def delete_from_playlist(video_id: str):
    """Delete a playlist entry by video_id."""
    if not delete_playlist_entry(video_id):
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": video_id}


@router.delete("/clear")
async def clear_all_playlist():
    """Clear all playlist entries."""
    count = clear_playlist()
    return {"cleared": count}


@router.patch("/cdn/{video_id}")
async def update_cdn(video_id: str, body: CdnUpdateRequest):
    """Update CDN URL for a playlist entry."""
    if not update_cdn_url(video_id, body.cdn_url):
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"updated": video_id}
