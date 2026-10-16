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
