from __future__ import annotations

import uuid

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

security = HTTPBearer(auto_error=False)

DEV_USER = uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_current_user_id(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> uuid.UUID:
    settings = get_settings()
    request.state.auth_via_supabase_jwt = False
    if creds and creds.scheme.lower() == "bearer" and settings.supabase_jwt_secret:
        try:
            payload = jwt.decode(
                creds.credentials,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": True},
            )
            sub = payload.get("sub")
            if not sub:
                raise HTTPException(status_code=401, detail="Invalid token: no sub")
            request.state.auth_via_supabase_jwt = True
            return uuid.UUID(sub)
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e

    if settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=401,
            detail=(
                "Missing or invalid Authorization: sign in on the app (Supabase session), "
                "and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY on the frontend to match this API’s project. "
                "The API ignores X-Dev-User-Id when SUPABASE_JWT_SECRET is set."
            ),
        )

    dev = request.headers.get("X-Dev-User-Id")
    if dev:
        try:
            return uuid.UUID(dev)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Bad X-Dev-User-Id") from e
    return DEV_USER
