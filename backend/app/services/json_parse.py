"""Parse and validate LLM output into FormDefinition."""

from __future__ import annotations

import json
import re

from pydantic import ValidationError

from app.models.schema import FormDefinition


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def strip_markdown_fences(text: str) -> str:
    t = text.strip()
    t = _FENCE.sub("", t).strip()
    return t


def parse_form_json(text: str) -> FormDefinition:
    raw = strip_markdown_fences(text)
    data = json.loads(raw)
    return FormDefinition.model_validate(data)


def parse_form_json_safe(text: str) -> tuple[FormDefinition | None, str | None]:
    try:
        return parse_form_json(text), None
    except (json.JSONDecodeError, ValidationError) as e:
        return None, str(e)
