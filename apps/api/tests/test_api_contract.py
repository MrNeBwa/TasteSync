from app.main import app


def test_movie_response_contract_in_openapi() -> None:
    schema = app.openapi()
    movie = schema["components"]["schemas"]["MovieResponse"]["properties"]
    assert movie["is_adult"]["type"] == "boolean"


def test_sessions_recommendations_endpoint_exists() -> None:
    schema = app.openapi()
    assert "/api/sessions/{session_id}/movies" in schema["paths"]


def test_movie_detail_endpoint_exists() -> None:
    schema = app.openapi()
    assert "/api/movies/{movie_id}" in schema["paths"]


def test_password_change_endpoint_exists() -> None:
    schema = app.openapi()
    assert "/api/users/me/password" in schema["paths"]
    assert "patch" in schema["paths"]["/api/users/me/password"]


def test_history_endpoint_exists() -> None:
    schema = app.openapi()
    assert "/api/me/history" in schema["paths"]


def test_sync_popular_requires_auth() -> None:
    schema = app.openapi()
    operation = schema["paths"]["/api/movies/sync-popular"]["post"]
    security = operation.get("security") or []
    assert any("HTTPBearer" in requirement for requirement in security)
