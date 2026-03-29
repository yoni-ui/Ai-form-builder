from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from app.config import Settings
from app.models.schema import FormDefinition


def get_supabase(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase URL and service role key must be set for database operations")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def form_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "slug": row["slug"],
        "published": row["published"],
        "definition": row["definition"],
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def create_form(
    sb: Client,
    user_id: uuid.UUID,
    title: str,
    definition: FormDefinition,
    published: bool = False,
) -> dict[str, Any]:
    slug = uuid.uuid4().hex[:12]
    row = {
        "user_id": str(user_id),
        "title": title,
        "slug": slug,
        "definition": definition.model_dump(mode="json"),
        "published": published,
        "updated_at": now_iso(),
    }
    res = sb.table("forms").insert(row).execute()
    if not res.data:
        raise RuntimeError("Failed to insert form")
    return form_row_to_api(res.data[0])


def get_form_owned(sb: Client, form_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any] | None:
    res = (
        sb.table("forms")
        .select("*")
        .eq("id", str(form_id))
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return form_row_to_api(res.data[0])


def get_public_form_by_slug(sb: Client, slug: str) -> dict[str, Any] | None:
    res = (
        sb.table("forms")
        .select("id,title,slug,published,definition,created_at,updated_at")
        .eq("slug", slug)
        .eq("published", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return form_row_to_api(res.data[0])


def update_form(
    sb: Client,
    form_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    title: str | None = None,
    definition: FormDefinition | None = None,
    published: bool | None = None,
    slug: str | None = None,
) -> dict[str, Any] | None:
    existing = get_form_owned(sb, form_id, user_id)
    if not existing:
        return None
    patch: dict[str, Any] = {"updated_at": now_iso()}
    if title is not None:
        patch["title"] = title
    if definition is not None:
        patch["definition"] = definition.model_dump(mode="json")
    if published is not None:
        patch["published"] = published
    if slug is not None:
        patch["slug"] = slug
    res = sb.table("forms").update(patch).eq("id", str(form_id)).eq("user_id", str(user_id)).execute()
    if not res.data:
        return None
    return form_row_to_api(res.data[0])


def list_forms(sb: Client, user_id: uuid.UUID) -> list[dict[str, Any]]:
    res = sb.table("forms").select("*").eq("user_id", str(user_id)).order("updated_at", desc=True).execute()
    return [form_row_to_api(r) for r in (res.data or [])]


def insert_response(sb: Client, form_id: uuid.UUID, answers: dict[str, Any]) -> dict[str, Any]:
    row = {"form_id": str(form_id), "answers": answers}
    res = sb.table("responses").insert(row).execute()
    if not res.data:
        raise RuntimeError("Failed to insert response")
    return res.data[0]


def list_responses(sb: Client, form_id: uuid.UUID, user_id: uuid.UUID) -> list[dict[str, Any]]:
    form = get_form_owned(sb, form_id, user_id)
    if not form:
        return []
    res = (
        sb.table("responses")
        .select("id,form_id,answers,created_at")
        .eq("form_id", str(form_id))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []
