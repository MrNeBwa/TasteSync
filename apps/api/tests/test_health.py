from fastapi.testclient import TestClient

from app.main import app


def test_health_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        payload = response.json()
        assert set(payload) == {"status", "database", "redis"}
        assert payload["status"] in {"ok", "degraded"}
        assert payload["database"] in {"ok", "error"}
        assert payload["redis"] in {"ok", "error"}
        assert payload["status"] == "ok" or payload["status"] == "degraded"


def test_cors_preflight_allows_lan_origin() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "http://192.168.100.7:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "*"


def test_cors_actual_request_sets_headers() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            headers={"Origin": "http://192.168.100.7:5173"},
            json={"username": "x", "password": "y"},
        )
        assert response.headers.get("access-control-allow-origin") == "*"