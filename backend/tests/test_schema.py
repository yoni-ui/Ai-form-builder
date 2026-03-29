import pytest
from pydantic import ValidationError

from app.models.schema import FieldType, FormDefinition, FormField, FormSection


def test_form_definition_minimal():
    d = FormDefinition(
        title="T",
        sections=[
            FormSection(
                id="sec_1",
                title="S",
                fields=[
                    FormField(id="f1", type=FieldType.TEXT, label="Name", required=True),
                ],
            )
        ],
    )
    assert d.version == 1


def test_select_requires_options():
    with pytest.raises(ValidationError):
        FormField(id="f1", type=FieldType.SELECT, label="Pick", options=None)
