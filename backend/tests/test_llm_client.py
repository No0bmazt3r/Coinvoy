import pytest
from fastapi import HTTPException
from pydantic import BaseModel

from app.llm import client as llm


class Week(BaseModel):
    gross_rm: float | None
    trips: int | None


def test_route_model_override_and_fallback(provider):
    assert llm.model_for("snap") == "vision-model"
    assert llm.model_for("tanya") == "shared-model"


def test_schema_reply_is_validated(provider):
    provider.reply = '{"gross_rm": 812.5, "trips": 61}'
    r = llm.chat("snap", [{"role": "user", "content": "read it"}], schema=Week)
    assert r.parsed == Week(gross_rm=812.5, trips=61)
    assert r.model == "vision-model" and r.input_tokens == 10
    assert provider.requests[0]["response_format"]["json_schema"]["name"] == "Week"


def test_fenced_json_is_accepted(provider):
    provider.reply = 'Here you go:\n```json\n{"gross_rm": null, "trips": 3}\n```'
    assert llm.chat("snap", [], schema=Week).parsed == Week(gross_rm=None, trips=3)


def test_provider_without_json_schema_gets_a_plain_retry(provider):
    provider.reject_schema = True
    provider.reply = '{"gross_rm": 1, "trips": 1}'
    assert llm.chat("snap", [], schema=Week).parsed.trips == 1
    assert "response_format" not in provider.requests[-1]


def test_invalid_json_is_a_502_not_a_guess(provider):
    provider.reply = '{"gross_rm": "lots"}'
    with pytest.raises(HTTPException) as e:
        llm.chat("snap", [], schema=Week)
    assert e.value.status_code == 502 and e.value.detail["code"] == "llm_bad_output"


def test_image_part_is_a_data_url():
    assert llm.image_part(b"hi", "image/png")["image_url"]["url"] == "data:image/png;base64,aGk="
