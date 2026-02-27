
from fastapi.testclient import TestClient

from tests.conftest import TEST_CHAT_ID, _make_supabase_table_mock


def test_create_chat(test_app, auth_headers):
    app, mock_service = test_app
    supabase = mock_service.get_supabase_client()

    chat_row = {
        "id": TEST_CHAT_ID,
        "user_id": "test-user",
        "character_id": "purplefrog",
        "title": None,
    }
    supabase.table.return_value = _make_supabase_table_mock(data=[chat_row])

    client = TestClient(app)
    response = client.post(
        "/chats",
        json={
            "chat_id": TEST_CHAT_ID,
            "character_id": "purplefrog",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["id"] == TEST_CHAT_ID


def test_list_chats(test_app, auth_headers):
    app, mock_service = test_app
    supabase = mock_service.get_supabase_client()

    supabase.table.return_value = _make_supabase_table_mock(data=[
        {"id": "chat-1", "character_id": "purplefrog", "title": "Test", "updated_at": "2026-01-01"},
    ])

    client = TestClient(app)
    response = client.get("/chats", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "chat-1"


def test_rename_chat(test_app, auth_headers):
    app, mock_service = test_app
    supabase = mock_service.get_supabase_client()

    supabase.table.return_value = _make_supabase_table_mock(
        data=[{"id": TEST_CHAT_ID, "title": "New Title"}]
    )

    client = TestClient(app)
    response = client.patch(
        f"/chats/{TEST_CHAT_ID}",
        json={"title": "New Title"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "New Title"


def test_rename_chat_returns_403_for_non_owner(test_app, auth_headers):
    app, mock_service = test_app
    supabase = mock_service.get_supabase_client()

    supabase.table.return_value = _make_supabase_table_mock(data=[])

    client = TestClient(app)
    response = client.patch(
        f"/chats/{TEST_CHAT_ID}",
        json={"title": "New Title"},
        headers=auth_headers,
    )

    assert response.status_code == 403


def test_delete_chat(test_app, auth_headers):
    app, mock_service = test_app
    supabase = mock_service.get_supabase_client()

    supabase.table.return_value = _make_supabase_table_mock(
        data=[{"id": TEST_CHAT_ID}]
    )

    client = TestClient(app)
    response = client.delete(f"/chats/{TEST_CHAT_ID}", headers=auth_headers)

    assert response.status_code == 204


def test_delete_chat_returns_403_for_non_owner(test_app, auth_headers):
    app, mock_service = test_app
    supabase = mock_service.get_supabase_client()

    supabase.table.return_value = _make_supabase_table_mock(data=[])

    client = TestClient(app)
    response = client.delete(f"/chats/{TEST_CHAT_ID}", headers=auth_headers)

    assert response.status_code == 403


def test_list_chats_requires_auth(test_app):
    app, _ = test_app
    client = TestClient(app)
    response = client.get("/chats")
    assert response.status_code in (401, 403)
