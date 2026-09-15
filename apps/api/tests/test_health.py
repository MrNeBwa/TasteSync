from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in {"ok", "degraded"}
        assert data["database"] in {"ok", "error"}
        assert data["redis"] in {"ok", "error"}
