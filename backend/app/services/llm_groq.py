from __future__ import annotations

from groq import Groq

from app.config import Settings


def groq_complete(settings: Settings, system: str, user: str) -> str:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    client = Groq(api_key=settings.groq_api_key)
    chat = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        max_tokens=8192,
    )
    choice = chat.choices[0]
    if not choice.message.content:
        raise RuntimeError("Empty Groq response")
    return choice.message.content
