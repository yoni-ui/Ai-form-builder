from __future__ import annotations

import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator

from app.config import get_settings
from app.db import (
    create_form,
    get_form_owned,
    get_public_form_by_slug,
    get_supabase,
    insert_response,
    list_forms,
    list_responses,
    update_form,
)
from app.deps import get_current_user_id
from app.models.schema import FormDefinition
from app.services.extract import extract_by_filename
from app.services.generate_form import generate_from_document_text, generate_from_prompt

router = APIRouter(prefix="/api", tags=["forms"])


class GenerateBody(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)
    provider: Literal["groq", "gemini"] = "groq"


class SaveFormBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    definition: FormDefinition
    published: bool = False


class PatchFormBody(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    definition: FormDefinition | None = None
    published: bool | None = None
    slug: str | None = None

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 3 or len(v) > 80:
            raise ValueError("slug length must be 3–80")
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("slug must be lowercase letters, digits, hyphens only")
        return v


class SubmitBody(BaseModel):
    answers: dict[str, object] = Field(default_factory=dict)


def _sb():
    settings = get_settings()
    try:
        return get_supabase(settings)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/forms/generate")
def api_generate(body: GenerateBody, user_id: uuid.UUID = Depends(get_current_user_id)):
    settings = get_settings()
    prov = body.provider
    if prov == "groq" and not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
    if prov == "gemini" and not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    try:
        definition = generate_from_prompt(settings, body.prompt, provider=prov)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"definition": definition.model_dump(mode="json")}


@router.post("/forms/from-document")
async def api_from_document(
    file: UploadFile = File(...),
    hint: str = "",
    provider: str = "groq",
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    settings = get_settings()
    prov = provider.lower()
    if prov not in ("groq", "gemini"):
        raise HTTPException(status_code=400, detail="provider must be groq or gemini")
    if prov == "groq" and not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
    if prov == "gemini" and not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    name = file.filename or "upload"
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    try:
        text = extract_by_filename(name, raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No extractable text (scanned PDF?). Add a prompt or paste text.",
        )
    try:
        definition = generate_from_document_text(settings, text, hint=hint, provider=prov)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"definition": definition.model_dump(mode="json"), "extracted_preview": text[:500]}


@router.get("/forms")
def api_list_forms(user_id: uuid.UUID = Depends(get_current_user_id)):
    sb = _sb()
    return {"forms": list_forms(sb, user_id)}


@router.post("/forms")
def api_create_form(body: SaveFormBody, user_id: uuid.UUID = Depends(get_current_user_id)):
    sb = _sb()
    try:
        row = create_form(sb, user_id, body.title, body.definition, published=body.published)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return row


@router.get("/forms/{form_id}")
def api_get_form(form_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id)):
    sb = _sb()
    row = get_form_owned(sb, form_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Form not found")
    return row


@router.patch("/forms/{form_id}")
def api_patch_form(
    form_id: uuid.UUID,
    body: PatchFormBody,
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    sb = _sb()
    row = update_form(
        sb,
        form_id,
        user_id,
        title=body.title,
        definition=body.definition,
        published=body.published,
        slug=body.slug,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Form not found")
    return row


@router.get("/forms/{form_id}/responses")
def api_list_responses(form_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id)):
    sb = _sb()
    rows = list_responses(sb, form_id, user_id)
    if rows == []:
        # distinguish not found vs empty
        if get_form_owned(sb, form_id, user_id) is None:
            raise HTTPException(status_code=404, detail="Form not found")
    return {"responses": rows}


@router.get("/public/forms/{slug}")
def api_public_form(slug: str):
    sb = _sb()
    row = get_public_form_by_slug(sb, slug)
    if not row:
        raise HTTPException(status_code=404, detail="Form not found or not published")
    return {
        "title": row["title"],
        "slug": row["slug"],
        "definition": row["definition"],
    }


@router.post("/public/forms/{slug}/submit")
def api_public_submit(slug: str, body: SubmitBody):
    sb = _sb()
    row = get_public_form_by_slug(sb, slug)
    if not row:
        raise HTTPException(status_code=404, detail="Form not found or not published")
    form_uuid = uuid.UUID(row["id"])
    try:
        saved = insert_response(sb, form_uuid, body.answers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"ok": True, "id": saved.get("id")}
