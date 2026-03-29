from app.models.schema import FormDefinition
from app.services.json_parse import parse_form_json


def test_parse_strip_fence():
    raw = """```json
{"version": 1, "title": "A", "sections": [{"id": "s1", "title": "S", "fields": [{"id": "f1", "type": "text", "label": "L", "required": false}]}]}
```"""
    d = parse_form_json(raw)
    assert isinstance(d, FormDefinition)
    assert d.title == "A"
