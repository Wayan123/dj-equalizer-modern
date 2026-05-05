from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from app.config import CORS_ORIGINS
from app.routes import youtube, audio, health, playlist
from app.services.db_service import init_db
from app.security.rate_limit import limiter

app = FastAPI(title="Modern Audio Enhancer Backend", version="3.0.0")
app.state.limiter = limiter


@app.on_event("startup")
def startup():
    init_db()


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(health.router, prefix="/api")
app.include_router(youtube.router, prefix="/api/youtube")
app.include_router(audio.router, prefix="/api/audio")
app.include_router(playlist.router, prefix="/api/playlist")
