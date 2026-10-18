import os
import tempfile

# Settings are read at import time, so point them at a throwaway DB and a fake Google client first.
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.update(DATABASE_URL=f"sqlite:///{_db.name}", GOOGLE_CLIENT_ID="test-client",
                  GOOGLE_CLIENT_SECRET="test-secret", APP_URL="http://localhost:5173", DEMO_ENABLED="true")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def provider(monkeypatch):
    """A fake OpenAI-compatible LLM provider. Queue replies in `.replies` (str, or a dict message with
    tool_calls); set `.reject_schema`; inspect `.requests`."""
    import json

    import httpx
    import openai

    from app.config import settings
    from app.llm import client as llm

    state = type("P", (), {"replies": [], "reply": "{}", "reject_schema": False, "requests": []})()

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        state.requests.append(body)
        if state.reject_schema and "response_format" in body:
            return httpx.Response(400, json={"error": {"message": "response_format not supported"}})
        reply = state.replies.pop(0) if state.replies else state.reply
        message = reply if isinstance(reply, dict) else {"role": "assistant", "content": reply}
        return httpx.Response(200, json={
            "id": "x", "object": "chat.completion", "created": 0, "model": "m",
            "choices": [{"index": 0, "finish_reason": "stop", "message": message}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}})

    monkeypatch.setattr(settings, "llm_api_key", "k")
    monkeypatch.setattr(settings, "llm_model", "shared-model")
    monkeypatch.setattr(settings, "llm_model_snap", "vision-model")
    monkeypatch.setattr(llm, "_client", openai.OpenAI(base_url="http://fake/v1", api_key="k", max_retries=0,
                                                      http_client=httpx.Client(transport=httpx.MockTransport(handle))))
    return state
