from __future__ import annotations

from app.config import Settings


def gemini_complete(settings: Settings, system: str, user: str) -> str:
    import google.generativeai as genai

    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        settings.gemini_model,
        system_instruction=system,
    )
    resp = model.generate_content(
        user,
        generation_config=genai.GenerationConfig(
            temperature=0.2,
            max_output_tokens=8192,
        ),
    )
    if not resp.text:
        raise RuntimeError("Empty Gemini response")
    return resp.text
