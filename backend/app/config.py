import os

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8800"))
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8800",
    ).split(",")
    if origin.strip()
]
MAX_FILE_SIZE_MB = 100
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/dj-eq-uploads")
YT_DLP_TIMEOUT = int(os.getenv("YT_DLP_TIMEOUT", "30"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "5"))
