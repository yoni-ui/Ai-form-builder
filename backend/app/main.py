import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import supabase_configured
from app.routers import dashboard, forms

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="useformly.ai API", version="0.1.0")

settings = get_settings()
if supabase_configured(settings):
    logger.info("useformly: persistence = Supabase")
else:
    logger.info("useformly: persistence = local SQLite (backend/.data/useformly_dev.sqlite3)")
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
