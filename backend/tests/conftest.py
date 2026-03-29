import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_JWT_SECRET", "")


@pytest.fixture
def client():
    from app.main import app

    return TestClient(app)
