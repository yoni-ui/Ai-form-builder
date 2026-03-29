import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import supabase_configured
from app.routers import dashboard, forms

logger = logging.getLogger("uvicorn.error")

_DEFAULT_CORS = "http://localhost:5173,http://127.0.0.1:5173"

app = FastAPI(title="useformly.ai API", version="0.1.0")

settings = get_settings()
if supabase_configured(settings):
    logger.info("useformly: persistence = Supabase")
else:
    logger.info("useformly: persistence = local SQLite (backend/.data/useformly_dev.sqlite3)")

if os.environ.get("RENDER"):
    if not supabase_configured(settings):
        logger.warning(
            "RENDER: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY should be set — "
            "SQLite on Render is ephemeral and resets; use Supabase for production data."
        )
    if (settings.cors_origins or "").strip() == _DEFAULT_CORS:
        logger.warning(
            "RENDER: CORS_ORIGINS is still localhost-only; set it to your frontend origin(s), "
            "e.g. https://your-app.vercel.app,http://localhost:5173"
        )
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forms.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "useformly.ai"}
