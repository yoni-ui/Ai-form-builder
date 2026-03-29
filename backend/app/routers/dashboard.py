from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request

from app.config import get_settings
from app.db import store_dashboard_forms
from app.deps import get_current_user_id
from app.services.credits import usage_snapshot

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/me/usage")
def api_me_usage(request: Request, user_id: uuid.UUID = Depends(get_current_user_id)):
    return usage_snapshot(get_settings(), request, user_id)


@router.get("/dashboard")
def api_dashboard(request: Request, user_id: uuid.UUID = Depends(get_current_user_id)):
    settings = get_settings()
    return {
        "usage": usage_snapshot(settings, request, user_id),
        "forms": store_dashboard_forms(settings, user_id),
    }
