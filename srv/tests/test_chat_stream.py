from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from tests.conftest import TEST_CHAT_ID


def test_chat_stream_requires_auth(client):
    response = client.post(
        "/chat/stream",
        json={
            "chat_id": TEST_CHAT_ID,
            "character_id": "purplefrog",
            "message": "Hello",
        },
    )
    assert response.status_code in (401, 403)


def test_chat_stream_rejects_invalid_token(client):
    response = client.post(
        "/chat/stream",
        json={
            "chat_id": TEST_CHAT_ID,
            "character_id": "purplefrog",
            "message": "Hello",
        },
        headers={"Authorization": "Bearer bad-token"},
    )
    assert response.status_code == 401


def test_chat_stream_returns_sse(test_app, auth_headers):
    app, mock_service = test_app

    async def fake_stream(**kwargs):
        yield 'event: token\ndata: {"text": "Hello "}\n\n'
        yield 'event: token\ndata: {"text": "world"}\n\n'
        yield f'event: done\ndata: {{"chat_id": "{TEST_CHAT_ID}"}}\n\n'

    mock_service.assert_chat_owner = AsyncMock()
    mock_service.stream = MagicMock(return_value=fake_stream())

    client = TestClient(app)
    response = client.post(
        "/chat/stream",
        json={
            "chat_id": TEST_CHAT_ID,
            "character_id": "purplefrog",
            "message": "Hello",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

    body = response.text
    assert "event: token" in body
    assert "event: done" in body
    assert '"Hello "' in body


def test_chat_stream_returns_403_for_wrong_owner(test_app, auth_headers):
    from fastapi import HTTPException

    app, mock_service = test_app

    mock_service.assert_chat_owner = AsyncMock(
        side_effect=HTTPException(status_code=403, detail="Access denied")
    )

    client = TestClient(app)
    response = client.post(
        "/chat/stream",
        json={
            "chat_id": TEST_CHAT_ID,
            "character_id": "purplefrog",
            "message": "Hello",
        },
        headers=auth_headers,
    )

    assert response.status_code == 403
