import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.audio_service import validate_and_save_upload
from app.config import MAX_FILE_SIZE_MB

ALLOWED_MIME_PREFIXES = {"audio/", "video/"}

router = APIRouter()


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    if not file.content_type or not any(file.content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=400, detail="Only audio/video files are accepted")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_FILE_SIZE_MB}MB)")

    try:
        filepath = await validate_and_save_upload(file.filename, contents)
        return {"filename": os.path.basename(filepath), "size": len(contents)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
