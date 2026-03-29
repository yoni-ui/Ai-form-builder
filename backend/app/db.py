from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from app.config import Settings
from app.models.schema import FormDefinition


def supabase_configured(settings: Settings) -> bool:
    return bool(
        (settings.supabase_url or "").strip() and (settings.supabase_service_role_key or "").strip()
    )


def get_supabase(settings: Settings) -> Client:
    if not supabase_configured(settings):
        raise RuntimeError("Supabase URL and service role key must be set for database operations")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# --- Unified store: Supabase in production, local SQLite when Supabase env is unset (local dev) ---


def store_list_forms(settings: Settings, user_id: uuid.UUID) -> list[dict[str, Any]]:
    if supabase_configured(settings):
        return list_forms(get_supabase(settings), user_id)
    from app import db_sqlite

    return db_sqlite.list_forms(user_id)


def store_create_form(
    settings: Settings,
    user_id: uuid.UUID,
    title: str,
    definition: FormDefinition,
    published: bool = False,
) -> dict[str, Any]:
    if supabase_configured(settings):
        return create_form(get_supabase(settings), user_id, title, definition, published)
    from app import db_sqlite

    return db_sqlite.create_form(user_id, title, definition, published)


def store_get_form_owned(
    settings: Settings, form_id: uuid.UUID, user_id: uuid.UUID
) -> dict[str, Any] | None:
    if supabase_configured(settings):
        return get_form_owned(get_supabase(settings), form_id, user_id)
    from app import db_sqlite

    return db_sqlite.get_form_owned(form_id, user_id)


def store_get_public_form_by_slug(settings: Settings, slug: str) -> dict[str, Any] | None:
    if supabase_configured(settings):
        return get_public_form_by_slug(get_supabase(settings), slug)
    from app import db_sqlite

    return db_sqlite.get_public_form_by_slug(slug)


def store_update_form(
    settings: Settings,
    form_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    title: str | None = None,
    definition: FormDefinition | None = None,
    published: bool | None = None,
    slug: str | None = None,
) -> dict[str, Any] | None:
    if supabase_configured(settings):
        return update_form(
            get_supabase(settings),
            form_id,
            user_id,
            title=title,
            definition=definition,
            published=published,
            slug=slug,
        )
    from app import db_sqlite

    return db_sqlite.update_form(
        form_id,
        user_id,
        title=title,
        definition=definition,
        published=published,
        slug=slug,
    )


def store_insert_response(
    settings: Settings, form_id: uuid.UUID, answers: dict[str, Any]
) -> dict[str, Any]:
    if supabase_configured(settings):
        return insert_response(get_supabase(settings), form_id, answers)
    from app import db_sqlite

    return db_sqlite.insert_response(form_id, answers)


def store_list_responses(
    settings: Settings, form_id: uuid.UUID, user_id: uuid.UUID
) -> list[dict[str, Any]]:
    if supabase_configured(settings):
        return list_responses(get_supabase(settings), form_id, user_id)
    from app import db_sqlite

    return db_sqlite.list_responses(form_id, user_id)


def _llm_usage_get_supabase(sb: Client, user_id: uuid.UUID, day: str) -> int:
    res = (
        sb.table("llm_usage")
        .select("count")
        .eq("user_id", str(user_id))
        .eq("day", day)
        .limit(1)
        .execute()
    )
    if res.data:
        return int(res.data[0]["count"])
    return 0


def _llm_usage_increment_supabase(sb: Client, user_id: uuid.UUID, day: str) -> None:
    c = _llm_usage_get_supabase(sb, user_id, day)
    row = {"user_id": str(user_id), "day": day, "count": c + 1}
    if c == 0:
        sb.table("llm_usage").insert(row).execute()
    else:
        sb.table("llm_usage").update({"count": c + 1}).eq("user_id", str(user_id)).eq("day", day).execute()


def store_llm_usage_get(settings: Settings, user_id: uuid.UUID, day: str) -> int:
    if supabase_configured(settings):
        return _llm_usage_get_supabase(get_supabase(settings), user_id, day)
    from app import db_sqlite

    return db_sqlite.llm_usage_get(user_id, day)


def store_llm_usage_increment(settings: Settings, user_id: uuid.UUID, day: str) -> None:
    if supabase_configured(settings):
        _llm_usage_increment_supabase(get_supabase(settings), user_id, day)
        return
    from app import db_sqlite

    db_sqlite.llm_usage_increment(user_id, day)


def store_response_counts_by_form_ids(settings: Settings, form_ids: list[str]) -> dict[str, int]:
    if not form_ids:
        return {}
    if supabase_configured(settings):
        sb = get_supabase(settings)
        res = sb.table("responses").select("form_id").in_("form_id", form_ids).execute()
        return dict(Counter(str(r["form_id"]) for r in (res.data or [])))
    from app import db_sqlite

    return db_sqlite.count_responses_by_form_ids(form_ids)


def store_dashboard_forms(settings: Settings, user_id: uuid.UUID) -> list[dict[str, Any]]:
    forms = store_list_forms(settings, user_id)
    ids = [str(f["id"]) for f in forms]
    counts = store_response_counts_by_form_ids(settings, ids)
    for f in forms:
        f["response_count"] = counts.get(str(f["id"]), 0)
    return forms


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
