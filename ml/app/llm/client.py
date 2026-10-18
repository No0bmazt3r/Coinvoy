"""One LLM client for every provider that speaks the OpenAI chat API.

OpenRouter, Gemini, OpenAI, Anthropic, Groq and Ollama all expose that API, so switching
provider means changing LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env, never code (ADR-9).
"""

import base64
import json
import re
from dataclasses import dataclass
from typing import Any, Literal

import openai
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.errors import api_error

Route = Literal["snap", "tanya", "lender", "bm"]

_client: openai.OpenAI | None = None


def _get_client() -> openai.OpenAI:
    global _client
    if _client is None:
        if not settings.llm_configured:
            raise api_error(503, "llm_unconfigured", "Ciri AI belum disediakan. Sila isi secara manual.",
                            "AI features aren't set up. Please enter it manually.")
        _client = openai.OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key,
                                timeout=settings.llm_timeout_s, max_retries=2)
    return _client


def model_for(route: Route) -> str:
    """Per-route override (LLM_MODEL_SNAP, ...) or the shared LLM_MODEL."""
    return getattr(settings, f"llm_model_{route}") or settings.llm_model


def image_part(data: bytes, mime: str = "image/jpeg") -> dict:
    """An image as a message content part. Every OpenAI-compatible provider accepts data URLs."""
    return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{base64.b64encode(data).decode()}"}}


@dataclass
class ChatResult:
    message: Any  # the provider's assistant message: .content, .tool_calls
    parsed: BaseModel | None  # set when a schema was given
    model: str
    input_tokens: int
    output_tokens: int


def chat(route: Route, messages: list[dict], *, schema: type[BaseModel] | None = None,
         tools: list[dict] | None = None, max_tokens: int = 1024) -> ChatResult:
    """One completion. With `schema`, the reply is validated JSON; anything else raises a 502."""
    model = model_for(route)
    kwargs: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if tools:
        kwargs["tools"] = tools
    if schema:
        kwargs["response_format"] = {"type": "json_schema", "json_schema": {
            "name": schema.__name__, "schema": schema.model_json_schema(), "strict": False}}
    try:
        try:
            resp = _get_client().chat.completions.create(**kwargs)
        except openai.BadRequestError:
            if not schema:
                raise
            # Some providers reject json_schema; the prompt asks for JSON and Pydantic still validates.
            kwargs.pop("response_format")
            resp = _get_client().chat.completions.create(**kwargs)
    except openai.APIError as e:
        raise api_error(502, "llm_failed", "AI tidak dapat dihubungi. Cuba lagi atau isi secara manual.",
                        "The AI couldn't be reached. Try again or enter it manually.") from e

    message = resp.choices[0].message
    parsed = _parse(message.content or "", schema) if schema else None
    usage = resp.usage
    return ChatResult(message, parsed, model, usage.prompt_tokens if usage else 0,
                      usage.completion_tokens if usage else 0)


def _parse(text: str, schema: type[BaseModel]) -> BaseModel:
    # Models without native JSON mode often wrap it in ``` fences or add a sentence around it.
    match = re.search(r"\{.*\}", text, re.DOTALL)
    try:
        return schema.model_validate(json.loads(match.group(0) if match else text))
    except (json.JSONDecodeError, ValidationError) as e:
        raise api_error(502, "llm_bad_output", "AI memberi jawapan yang tidak sah. Sila isi secara manual.",
                        "The AI gave an invalid answer. Please enter it manually.") from e
