"""Local SQLite persistence when Supabase is not configured (dev-only)."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.schema import FormDefinition

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DB_PATH = _BACKEND_DIR / ".data" / "useformly_dev.sqlite3"

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA foreign_keys = ON")
            _conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS forms (
                  id TEXT PRIMARY KEY,
                  user_id TEXT NOT NULL,
                  title TEXT NOT NULL,
                  slug TEXT NOT NULL UNIQUE,
                  definition TEXT NOT NULL,
                  published INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS responses (
                  id TEXT PRIMARY KEY,
                  form_id TEXT NOT NULL,
                  answers TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS forms_user_id_idx ON forms(user_id);
                CREATE INDEX IF NOT EXISTS responses_form_id_idx ON responses(form_id);
                """
            )
            _conn.commit()
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS llm_usage (
              user_id TEXT NOT NULL,
              day TEXT NOT NULL,
              count INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (user_id, day)
            )
            """
        )
        _conn.commit()
        return _conn


def form_row_to_api(row: dict[str, Any]) -> dict[str, Any]:
    definition = row["definition"]
    if isinstance(definition, str):
        definition = json.loads(definition)
    return {
        "id": row["id"],
        "title": row["title"],
        "slug": row["slug"],
        "published": bool(row["published"]),
        "definition": definition,
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def create_form(
    user_id: uuid.UUID,
    title: str,
    definition: FormDefinition,
    published: bool = False,
) -> dict[str, Any]:
    conn = _get_conn()
    fid = str(uuid.uuid4())
    slug = uuid.uuid4().hex[:12]
    ts = now_iso()
    def_json = json.dumps(definition.model_dump(mode="json"))
    conn.execute(
        """INSERT INTO forms (id, user_id, title, slug, definition, published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (fid, str(user_id), title, slug, def_json, 1 if published else 0, ts, ts),
    )
    conn.commit()
    return form_row_to_api(
        {
            "id": fid,
            "title": title,
            "slug": slug,
            "published": published,
            "definition": definition.model_dump(mode="json"),
            "created_at": ts,
            "updated_at": ts,
        }
    )


def get_form_owned(form_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any] | None:
    conn = _get_conn()
    cur = conn.execute(
        "SELECT * FROM forms WHERE id = ? AND user_id = ?",
        (str(form_id), str(user_id)),
    )
    row = cur.fetchone()
    if not row:
        return None
    d = dict(row)
    return form_row_to_api(d)


def get_public_form_by_slug(slug: str) -> dict[str, Any] | None:
    conn = _get_conn()
    cur = conn.execute(
        "SELECT * FROM forms WHERE slug = ? AND published = 1",
        (slug,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return form_row_to_api(dict(row))


def update_form(
    form_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    title: str | None = None,
    definition: FormDefinition | None = None,
    published: bool | None = None,
    slug: str | None = None,
) -> dict[str, Any] | None:
    existing = get_form_owned(form_id, user_id)
    if not existing:
        return None
    patch_title = title if title is not None else existing["title"]
    patch_def = definition.model_dump(mode="json") if definition is not None else existing["definition"]
    patch_pub = published if published is not None else existing["published"]
    patch_slug = slug if slug is not None else existing["slug"]
    ts = now_iso()
    conn = _get_conn()
    conn.execute(
        """UPDATE forms SET title = ?, definition = ?, published = ?, slug = ?, updated_at = ?
           WHERE id = ? AND user_id = ?""",
        (
            patch_title,
            json.dumps(patch_def),
            1 if patch_pub else 0,
            patch_slug,
            ts,
            str(form_id),
            str(user_id),
        ),
    )
    conn.commit()
    return get_form_owned(form_id, user_id)


def list_forms(user_id: uuid.UUID) -> list[dict[str, Any]]:
    conn = _get_conn()
    cur = conn.execute(
        "SELECT * FROM forms WHERE user_id = ? ORDER BY updated_at DESC",
        (str(user_id),),
    )
    return [form_row_to_api(dict(r)) for r in cur.fetchall()]


def insert_response(form_id: uuid.UUID, answers: dict[str, Any]) -> dict[str, Any]:
    conn = _get_conn()
    rid = str(uuid.uuid4())
    ts = now_iso()
    conn.execute(
        "INSERT INTO responses (id, form_id, answers, created_at) VALUES (?, ?, ?, ?)",
        (rid, str(form_id), json.dumps(answers), ts),
    )
    conn.commit()
    return {"id": rid, "form_id": str(form_id), "answers": answers, "created_at": ts}


def list_responses(form_id: uuid.UUID, user_id: uuid.UUID) -> list[dict[str, Any]]:
    if get_form_owned(form_id, user_id) is None:
        return []
    conn = _get_conn()
    cur = conn.execute(
        "SELECT id, form_id, answers, created_at FROM responses WHERE form_id = ? ORDER BY created_at DESC",
        (str(form_id),),
    )
    out: list[dict[str, Any]] = []
    for r in cur.fetchall():
        d = dict(r)
        ans = d["answers"]
        if isinstance(ans, str):
            ans = json.loads(ans)
        out.append({"id": d["id"], "form_id": d["form_id"], "answers": ans, "created_at": d["created_at"]})
    return out


def llm_usage_get(user_id: uuid.UUID, day: str) -> int:
    conn = _get_conn()
    cur = conn.execute(
        "SELECT count FROM llm_usage WHERE user_id = ? AND day = ?",
        (str(user_id), day),
    )
    row = cur.fetchone()
    return int(row[0]) if row else 0


def llm_usage_increment(user_id: uuid.UUID, day: str) -> None:
    conn = _get_conn()
    conn.execute(
        """
        INSERT INTO llm_usage (user_id, day, count) VALUES (?, ?, 1)
        ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
        """,
        (str(user_id), day),
    )
    conn.commit()


def count_responses_by_form_ids(form_ids: list[str]) -> dict[str, int]:
    if not form_ids:
        return {}
    conn = _get_conn()
    q = ",".join("?" * len(form_ids))
    cur = conn.execute(
        f"SELECT form_id, COUNT(*) as c FROM responses WHERE form_id IN ({q}) GROUP BY form_id",
        form_ids,
    )
    return {str(row["form_id"]): int(row["c"]) for row in cur.fetchall()}
