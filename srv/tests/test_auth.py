import pytest
from fastapi import HTTPException

from app.auth import verify_supabase_jwt
from tests.conftest import TEST_USER_ID, make_test_jwt


def test_valid_jwt_returns_user_id():
    token = make_test_jwt(TEST_USER_ID)
    payload = verify_supabase_jwt(token)
    assert payload["sub"] == TEST_USER_ID


def test_expired_jwt_raises_401():
    token = make_test_jwt(expired=True)
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt(token)
    assert exc_info.value.status_code == 401


def test_invalid_jwt_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt("not-a-valid-token")
    assert exc_info.value.status_code == 401


def test_wrong_secret_raises_401():
    from jose import jwt as jose_jwt

    token = jose_jwt.encode(
        {"sub": TEST_USER_ID, "aud": "authenticated", "exp": 9999999999},
        "wrong-secret",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_supabase_jwt(token)
    assert exc_info.value.status_code == 401
