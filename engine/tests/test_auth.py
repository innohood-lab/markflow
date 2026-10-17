from fastapi.testclient import TestClient
import markflow_engine.api as api_module
from markflow_engine.api import app

client = TestClient(app)


def test_auth_without_secret_set():
    # If no secret is configured, calls succeed
    api_module.ENGINE_SECRET = None
    res = client.post("/similarity/recommendations", json={"text": "hello", "candidates": []})
    assert res.status_code == 200


def test_auth_with_secret_configured():
    # Set a mock secret
    api_module.ENGINE_SECRET = "super-secret-token-12345"

    try:
        # Health should still succeed without token
        health_res = client.get("/health")
        assert health_res.status_code == 200

        # Post without secret should fail with 403
        no_auth_res = client.post(
            "/similarity/recommendations", json={"text": "hello", "candidates": []}
        )
        assert no_auth_res.status_code == 403
        assert "Unauthorized" in no_auth_res.json()["message"]

        # Post with wrong secret should fail with 403
        wrong_auth_res = client.post(
            "/similarity/recommendations",
            json={"text": "hello", "candidates": []},
            headers={"X-Engine-Secret": "wrong-token"},
        )
        assert wrong_auth_res.status_code == 403

        # Post with correct secret should succeed with 200
        correct_auth_res = client.post(
            "/similarity/recommendations",
            json={"text": "hello", "candidates": []},
            headers={"X-Engine-Secret": "super-secret-token-12345"},
        )
        assert correct_auth_res.status_code == 200

    finally:
        api_module.ENGINE_SECRET = None
