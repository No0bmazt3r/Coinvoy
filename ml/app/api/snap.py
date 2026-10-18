"""POST /api/snap/extract: screenshots in, drafts out. Nothing is saved until /api/weeks/confirm (FR-SNAP-2)."""

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.errors import api_error
from app.llm import snap
from app.llm.usage import check_quota, log_usage
from app.models import User
from app.services.salary import platforms_of

router = APIRouter(prefix="/api/snap", tags=["snap"])
MAX_FILES = 5


@router.post("/extract")
async def extract(files: list[UploadFile] = File(...), user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> dict:
    if not 1 <= len(files) <= MAX_FILES:
        raise api_error(422, "too_many_images", "Pilih 1 hingga 5 gambar.", "Choose 1 to 5 images.")
    check_quota(db, user.id, "snap", calls=len(files))
    platforms = platforms_of(db, user.id)
    rows, not_earnings = [], 0
    for f in files:
        image = snap.clean_image(await f.read(snap.MAX_BYTES + 1))  # bytes stay in memory only (FR-SNAP-4)
        out, call = snap.extract(image, platforms)
        if call:
            log_usage(db, user.id, "snap", call)
        if not out.is_earnings_screen:
            not_earnings += 1
        rows += snap.drafts(out, platforms[0] if platforms else "other")
    db.commit()
    return {"drafts": rows, "notEarnings": not_earnings}
