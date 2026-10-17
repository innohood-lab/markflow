from fastapi.testclient import TestClient
from markflow_engine.api import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert "markitdown_version" in data
    assert data["markitdown_version"] != "unknown"
