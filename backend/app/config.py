from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env from backend/ first, then repo root (root wins for duplicate keys).
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent
_dotenv_paths: list[Path] = []
for _p in (_BACKEND_DIR / ".env", _REPO_ROOT / ".env"):
    if _p.is_file():
        _dotenv_paths.append(_p)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_dotenv_paths if _dotenv_paths else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    groq_api_key: str = ""
    gemini_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_model: str = "gemini-1.5-flash"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI generations per calendar day (UTC) for Supabase signed-in users only; 0 = unlimited
    daily_llm_credit_limit: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
