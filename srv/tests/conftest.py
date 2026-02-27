import os
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from jose import jwt

os.environ.setdefault("APP_SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("APP_SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("APP_OPENAI_API_KEY", "sk-test")
os.environ.setdefault("APP_LLM_MODEL", "gpt-4o")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")

TEST_JWT_SECRET = "test-jwt-secret"
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_CHAT_ID = "00000000-0000-0000-0000-000000000099"


def make_test_jwt(user_id: str = TEST_USER_ID, expired: bool = False) -> str:
    now = datetime.now(timezone.utc)
    exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
    payload = {
        "sub": user_id,
        "aud": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "role": "authenticated",
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers():
    token = make_test_jwt()
    return {"Authorization": f"Bearer {token}"}


def _make_supabase_table_mock(data=None):
    """Create a mock that supports Supabase's chained query builder pattern."""
    table = MagicMock()
    table.select.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.upsert.return_value = table
    table.delete.return_value = table
    table.eq.return_value = table
    table.order.return_value = table
    table.limit.return_value = table
    table.single.return_value = table
    table.maybe_single.return_value = table

    result = MagicMock()
    result.data = data if data is not None else []
    table.execute.return_value = result

    return table


@pytest.fixture
def mock_session_service():
    service = MagicMock()
    service.assert_chat_owner = AsyncMock()

    supabase = MagicMock()
    default_table = _make_supabase_table_mock()
    supabase.table.return_value = default_table

    service.get_supabase_client.return_value = supabase
    return service


@pytest.fixture
def test_app(mock_session_service):
    from dependency_injector import providers

    from app.containers import ApplicationContainer
    from app.main import create_app

    app = create_app()
    container: ApplicationContainer = app.state.container

    container.avatar_session_service.override(
        providers.Object(mock_session_service)
    )

    yield app, mock_session_service

    container.avatar_session_service.reset_override()


@pytest.fixture
def client(test_app):
    app, _ = test_app
    return TestClient(app)
