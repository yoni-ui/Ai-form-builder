"""Canonical form schema v1 — shared contract for LLM, API, DB, and frontend."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

FORM_SCHEMA_VERSION: Literal[1] = 1
MAX_EXTRACT_CHARS = 30_000


class FieldType(str, Enum):
    TEXT = "text"
    EMAIL = "email"
    NUMBER = "number"
    TEXTAREA = "textarea"
    SELECT = "select"
    CHECKBOX = "checkbox"
    DATE = "date"


class FormField(BaseModel):
    id: str = Field(..., min_length=1, max_length=128)
    type: FieldType
    label: str = Field(..., min_length=1, max_length=500)
    required: bool = False
    options: list[str] | None = None
    placeholder: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def select_needs_options(self) -> FormField:
        if self.type == FieldType.SELECT:
            if not self.options:
                raise ValueError("select fields must have non-empty options")
        return self


class FormSection(BaseModel):
    id: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=500)
    fields: list[FormField] = Field(default_factory=list)


class FormDefinition(BaseModel):
    version: Literal[1] = 1
    title: str = Field(..., min_length=1, max_length=500)
    sections: list[FormSection] = Field(..., min_length=1)

    @field_validator("sections")
    @classmethod
    def sections_have_fields(cls, v: list[FormSection]) -> list[FormSection]:
        for s in v:
            if not s.fields:
                raise ValueError(f"section '{s.id}' must have at least one field")
        return v


def form_definition_json_schema() -> dict:
    """JSON Schema for LLM / documentation."""
    return FormDefinition.model_json_schema()
