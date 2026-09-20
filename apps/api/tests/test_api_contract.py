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


def test_room_task_update_endpoint_exists() -> None:
    schema = app.openapi()
    assert "/api/rooms/{room_id}/task" in schema["paths"]
    assert "patch" in schema["paths"]["/api/rooms/{room_id}/task"]


def test_room_task_update_request_schema() -> None:
    schema = app.openapi()
    task = schema["components"]["schemas"]["UpdateRoomTaskRequest"]["properties"]["task"]
    assert task["$ref"].endswith("RoomTask")


def test_room_task_enum_matches_web_modes() -> None:
    from app.models.room import RoomTask

    assert {task.value for task in RoomTask} == {"movies", "restaurants", "entertainment"}
