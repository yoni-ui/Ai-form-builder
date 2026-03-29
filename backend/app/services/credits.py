"""Daily LLM usage limits for users authenticated with Supabase JWT."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from app.config import Settings
from app.db import store_llm_usage_get, store_llm_usage_increment


def utc_today_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def consume_llm_credit_if_applicable(settings: Settings, request: Request, user_id: uuid.UUID) -> None:
    if settings.daily_llm_credit_limit <= 0:
        return
    if not getattr(request.state, "auth_via_supabase_jwt", False):
        return
    day = utc_today_str()
    used = store_llm_usage_get(settings, user_id, day)
    if used >= settings.daily_llm_credit_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily AI generation limit reached ({settings.daily_llm_credit_limit} per UTC day). "
                "Try again tomorrow or contact the site owner."
            ),
        )
    store_llm_usage_increment(settings, user_id, day)


def usage_snapshot(settings: Settings, request: Request, user_id: uuid.UUID) -> dict:
    tracked = bool(getattr(request.state, "auth_via_supabase_jwt", False))
    limit = settings.daily_llm_credit_limit
    if limit <= 0:
        return {
            "tracked": tracked,
            "daily_limit": 0,
            "used_today": 0,
            "remaining": None,
            "unlimited": True,
        }
    if not tracked:
        return {
            "tracked": False,
            "daily_limit": limit,
            "used_today": 0,
            "remaining": None,
            "unlimited": False,
            "note": "Limits apply when signed in with Supabase (not dev X-Dev-User-Id).",
        }
    used = store_llm_usage_get(settings, user_id, utc_today_str())
    return {
        "tracked": True,
        "daily_limit": limit,
        "used_today": used,
        "remaining": max(0, limit - used),
        "unlimited": False,
    }
