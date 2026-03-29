"""System / user prompts for JSON form generation."""

import json

from app.models.schema import form_definition_json_schema

SYSTEM_FORM_DESIGNER = """You are a form designer. Output ONLY a single JSON object matching this structure (no markdown, no code fences, no commentary):
- version: must be integer 1
- title: string
- sections: array of { id, title, fields }
- each field: { id, type, label, required?, options?, placeholder? }
- field type must be one of: text, email, number, textarea, select, checkbox, date
- select fields MUST include a non-empty "options" array of strings
- every section must have at least one field
Use stable ids: sec_1, sec_2, f1, f2, etc. or short slugs."""

JSON_SCHEMA_HINT = json.dumps(form_definition_json_schema(), indent=2)[:12000]


def user_message_prompt_only(user_prompt: str) -> str:
    return f"""Create a form definition JSON for the following request.

Request:
{user_prompt}

JSON schema reference (subset):
{JSON_SCHEMA_HINT}
"""


def user_message_with_document(user_prompt: str, document_excerpt: str) -> str:
    return f"""Infer a form definition JSON from the document text below. Use sections and fields that match the document's questions or data fields.
Optional extra instruction from user: {user_prompt or "(none)"}

Document text (may be truncated):
{document_excerpt}

JSON schema reference (subset):
{JSON_SCHEMA_HINT}
"""


def retry_message_parse_error(bad_text: str, error: str) -> str:
    return f"""Your previous output was invalid. Fix it and output ONLY valid JSON.

Validation error: {error}

Previous output (fix this):
{bad_text[:8000]}
"""
