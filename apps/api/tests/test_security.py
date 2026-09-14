from uuid import uuid4
from datetime import timedelta

from app.core.security import create_token, decode_token, hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    password = "correct horse battery staple"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("wrong", password_hash)


def test_access_token_roundtrip() -> None:
    user_id = uuid4()
    token = create_token(user_id, token_type="access", expires_delta=timedelta(minutes=5))

    assert decode_token(token, expected_type="access") == user_id
