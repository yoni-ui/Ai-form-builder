from __future__ import annotations

import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, field_validator

from app.config import get_settings
from app.db import (
    store_create_form,
    store_get_form_owned,
    store_get_public_form_by_slug,
    store_insert_response,
    store_list_forms,
    store_list_responses,
    store_update_form,
)
from app.deps import get_current_user_id
from app.models.schema import FormDefinition
from app.services.credits import consume_llm_credit_if_applicable
from app.services.extract import extract_by_filename
from app.services.generate_form import generate_from_document_text, generate_from_prompt

router = APIRouter(prefix="/api", tags=["forms"])


def _charge_llm(settings, request: Request, user_id: uuid.UUID) -> None:
    consume_llm_credit_if_applicable(settings, request, user_id)


def resolve_llm_provider(settings, explicit: str | None) -> Literal["groq", "gemini"]:
    """Pick Groq when configured, else Gemini; optional explicit override."""
    if explicit == "groq":
        if not (settings.groq_api_key or "").strip():
            raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
        return "groq"
    if explicit == "gemini":
        if not (settings.gemini_api_key or "").strip():
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
        return "gemini"
    if (settings.groq_api_key or "").strip():
        return "groq"
    if (settings.gemini_api_key or "").strip():
        return "gemini"
    raise HTTPException(
        status_code=503,
        detail="No LLM configured. Set GROQ_API_KEY and/or GEMINI_API_KEY in .env (backend/ or repo root).",
    )


class GenerateBody(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)
    provider: Literal["groq", "gemini"] | None = None


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


@router.post("/forms/create")
async def api_llm_create(
    request: Request,
    prompt: str = Form(default=""),
    file: UploadFile | None = File(default=None),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Single entry: optional prompt + optional PDF/DOCX (at least one required). Provider auto-selected."""
    settings = get_settings()
    prov = resolve_llm_provider(settings, None)
    hint = (prompt or "").strip()[:8000]
    has_file = file is not None and bool((file.filename or "").strip())

    if has_file:
        name = file.filename or "upload"
        raw = await file.read()
        if len(raw) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        try:
            text = extract_by_filename(name, raw)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if not text.strip():
            if hint:
                try:
                    _charge_llm(settings, request, user_id)
                    definition = generate_from_prompt(settings, hint, provider=prov)
                except ValueError as e:
                    raise HTTPException(status_code=422, detail=str(e)) from e
                except RuntimeError as e:
                    raise HTTPException(status_code=502, detail=str(e)) from e
                return {"definition": definition.model_dump(mode="json")}
            raise HTTPException(
                status_code=422,
                detail="No extractable text from file (scanned PDF?). Add instructions in the text field.",
            )
        try:
            definition = generate_from_document_text(settings, text, hint=hint, provider=prov)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
        return {"definition": definition.model_dump(mode="json")}

    if hint:
        try:
            definition = generate_from_prompt(settings, hint, provider=prov)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
        return {"definition": definition.model_dump(mode="json")}

    raise HTTPException(
        status_code=400,
        detail="Enter a prompt and/or attach a PDF or DOCX file.",
    )


@router.post("/forms/generate")
def api_generate(
    request: Request,
    body: GenerateBody,
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    settings = get_settings()
    prov = resolve_llm_provider(settings, body.provider)
    try:
        _charge_llm(settings, request, user_id)
        definition = generate_from_prompt(settings, body.prompt, provider=prov)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"definition": definition.model_dump(mode="json")}


@router.post("/forms/from-document")
async def api_from_document(
    request: Request,
    file: UploadFile = File(...),
    hint: str = "",
    provider: str | None = None,
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    settings = get_settings()
    ex: str | None = None
    if provider and provider.strip():
        pl = provider.strip().lower()
        if pl not in ("groq", "gemini"):
            raise HTTPException(status_code=400, detail="provider must be groq or gemini")
        ex = pl
    prov = resolve_llm_provider(settings, ex)
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
        _charge_llm(settings, request, user_id)
        definition = generate_from_document_text(settings, text, hint=hint, provider=prov)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"definition": definition.model_dump(mode="json"), "extracted_preview": text[:500]}


@router.get("/forms")
def api_list_forms(user_id: uuid.UUID = Depends(get_current_user_id)):
    settings = get_settings()
    return {"forms": store_list_forms(settings, user_id)}


@router.post("/forms")
def api_save_form(body: SaveFormBody, user_id: uuid.UUID = Depends(get_current_user_id)):
    settings = get_settings()
    try:
        row = store_create_form(
            settings, user_id, body.title, body.definition, published=body.published
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return row


@router.get("/forms/{form_id}")
def api_get_form(form_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id)):
    settings = get_settings()
    row = store_get_form_owned(settings, form_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Form not found")
    return row


@router.patch("/forms/{form_id}")
def api_patch_form(
    form_id: uuid.UUID,
    body: PatchFormBody,
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    settings = get_settings()
    row = store_update_form(
        settings,
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
    settings = get_settings()
    rows = store_list_responses(settings, form_id, user_id)
    if rows == []:
        # distinguish not found vs empty
        if store_get_form_owned(settings, form_id, user_id) is None:
            raise HTTPException(status_code=404, detail="Form not found")
    return {"responses": rows}


@router.get("/public/forms/{slug}")
def api_public_form(slug: str):
    settings = get_settings()
    row = store_get_public_form_by_slug(settings, slug)
    if not row:
        raise HTTPException(status_code=404, detail="Form not found or not published")
    return {
        "title": row["title"],
        "slug": row["slug"],
        "definition": row["definition"],
    }


@router.post("/public/forms/{slug}/submit")
def api_public_submit(slug: str, body: SubmitBody):
    settings = get_settings()
    row = store_get_public_form_by_slug(settings, slug)
    if not row:
        raise HTTPException(status_code=404, detail="Form not found or not published")
    form_uuid = uuid.UUID(row["id"])
    try:
        saved = store_insert_response(settings, form_uuid, body.answers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"ok": True, "id": saved.get("id")}
