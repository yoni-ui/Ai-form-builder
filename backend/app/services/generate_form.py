"""Orchestrate LLM → FormDefinition with one retry on parse failure."""

from __future__ import annotations

from typing import Literal

from app.config import Settings
from app.models.schema import FormDefinition
from app.services import prompts
from app.services.json_parse import parse_form_json_safe
from app.services.llm_gemini import gemini_complete
from app.services.llm_groq import groq_complete

Provider = Literal["groq", "gemini"]


def _complete(settings: Settings, provider: Provider, system: str, user: str) -> str:
    if provider == "groq":
        return groq_complete(settings, system, user)
    return gemini_complete(settings, system, user)


def generate_from_prompt(settings: Settings, user_prompt: str, provider: Provider = "groq") -> FormDefinition:
    system = prompts.SYSTEM_FORM_DESIGNER
    user = prompts.user_message_prompt_only(user_prompt)
    text = _complete(settings, provider, system, user)
    parsed, err = parse_form_json_safe(text)
    if parsed is not None:
        return parsed
    retry_user = prompts.retry_message_parse_error(text, err or "unknown")
    text2 = _complete(settings, provider, system, retry_user)
    parsed2, err2 = parse_form_json_safe(text2)
    if parsed2 is None:
        raise ValueError(f"LLM returned invalid JSON after retry: {err2}")
    return parsed2


def generate_from_document_text(
    settings: Settings,
    document_excerpt: str,
    hint: str = "",
    provider: Provider = "groq",
) -> FormDefinition:
    system = prompts.SYSTEM_FORM_DESIGNER
    user = prompts.user_message_with_document(hint, document_excerpt)
    text = _complete(settings, provider, system, user)
    parsed, err = parse_form_json_safe(text)
    if parsed is not None:
        return parsed
    retry_user = prompts.retry_message_parse_error(text, err or "unknown")
    text2 = _complete(settings, provider, system, retry_user)
    parsed2, err2 = parse_form_json_safe(text2)
    if parsed2 is None:
        raise ValueError(f"LLM returned invalid JSON after retry: {err2}")
    return parsed2
