from fastapi import HTTPException


def api_error(status: int, code: str, message_ms: str, message_en: str) -> HTTPException:
    """Errors reach the client as {"error": {code, message_ms, message_en}} (architecture §10)."""
    return HTTPException(status, detail={"code": code, "message_ms": message_ms, "message_en": message_en})
