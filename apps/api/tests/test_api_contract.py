from app.main import app


def test_movie_response_contract_in_openapi() -> None:
    schema = app.openapi()
    movie = schema["components"]["schemas"]["MovieResponse"]["properties"]
    assert movie["is_adult"]["type"] == "boolean"


def test_sessions_recommendations_endpoint_exists() -> None:
    schema = app.openapi()
    assert "/api/sessions/{session_id}/movies" in schema["paths"]
