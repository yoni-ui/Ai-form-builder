from unittest.mock import patch

from app.config import Settings
from app.models.schema import FieldType, FormDefinition, FormField, FormSection
from app.services.generate_form import generate_from_prompt


def sample_json() -> str:
    d = FormDefinition(
        title="Job",
        sections=[
            FormSection(
                id="sec_1",
                title="Info",
                fields=[
                    FormField(id="f1", type=FieldType.EMAIL, label="Email", required=True),
                ],
            )
        ],
    )
    import json

    return json.dumps(d.model_dump(mode="json"))


@patch("app.services.generate_form._complete")
def test_generate_retries_after_invalid_json(mock_complete):
    settings = Settings(groq_api_key="x")
    mock_complete.side_effect = ["not json {", sample_json()]
    out = generate_from_prompt(settings, "make a form", provider="groq")
    assert out.title == "Job"
    assert mock_complete.call_count == 2
