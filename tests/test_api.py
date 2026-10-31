from fastapi.testclient import TestClient
import pytest

from backend import api, auth
from backend.auth_store import AuthStore


@pytest.fixture
def farmer_client(tmp_path, monkeypatch):
    store = AuthStore(tmp_path / "test-api-auth.sqlite3")
    monkeypatch.setattr(auth, "store", store)
    monkeypatch.setattr(api, "auth_store", store)
    with auth._rate_lock:
        auth._requests.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/auth/farmer/register", json={"email": "farmer@example.test", "password": "Farmer123", "display_name": "Test Farmer", "mobile_number": "9876543210"})
        assert response.status_code == 201, response.text
        yield client


def request_values(**overrides):
    return {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88,
            "humidity": 82, "ph": 6.5, "soil_moisture": 44, "location_name": "Test Farm", "village_town": "Test Farm", "farm_district": "Chennai", "farm_state": "Tamil Nadu", "land_area_acres": 1, **overrides}


def test_health_reports_trained_model():
    with TestClient(api.app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"



def test_recommendations_require_farmer_session_and_farm_location(farmer_client):
    response = farmer_client.post("/api/farmer/recommend", json=request_values())
    assert response.status_code == 200
    body = response.json()
    assert len(body["recommendations"]) == 5
    scores = [item["score"] for item in body["recommendations"]]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= score <= 1 for score in scores)
    assert sum(scores) <= 1.001
    assert all(item["explanation"] for item in body["recommendations"])
    assert "not a calibrated probability" in body["score_interpretation"]
    assert body["within_observed_feature_ranges"] is True
    assert body["report_id"] == "00001"


def test_recommendation_report_ids_are_sequential_and_private_per_farmer(farmer_client):
    first = farmer_client.post("/api/farmer/recommend", json=request_values()).json()
    second = farmer_client.post("/api/farmer/recommend", json=request_values()).json()
    assert first["report_id"] == "00001"
    assert second["report_id"] == "00002"
    history = farmer_client.get("/api/farmer/history").json()
    assert sorted(item["report_id"] for item in history["items"]) == ["00001", "00002"]

    with TestClient(api.app) as second_farmer:
        registration = second_farmer.post("/api/auth/farmer/register", json={
            "email": "another-farmer@example.test", "password": "Farmer123",
            "display_name": "Another Farmer", "mobile_number": "9876543211",
        })
        assert registration.status_code == 201
        other_report = second_farmer.post("/api/farmer/recommend", json=request_values()).json()
        assert other_report["report_id"] == "00001"
        assert [item["report_id"] for item in second_farmer.get("/api/farmer/history").json()["items"]] == ["00001"]


def test_recommendation_is_not_public_and_requires_farmer_session():
    with TestClient(api.app) as client:
        response = client.post("/api/farmer/recommend", json=request_values())
        assert response.status_code == 401
        assert client.post("/api/recommend", json=request_values()).status_code == 404


def test_invalid_inputs_are_rejected(farmer_client):
    response = farmer_client.post("/api/farmer/recommend", json=request_values(nitrogen=-1))
    assert response.status_code == 422


def test_boolean_measurements_are_rejected(farmer_client):
    response = farmer_client.post("/api/farmer/recommend", json=request_values(nitrogen=True))
    assert response.status_code == 422


def test_values_outside_training_ranges_are_flagged(farmer_client):
    response = farmer_client.post("/api/farmer/recommend", json=request_values(nitrogen=500))
    assert response.status_code == 200
    assert response.json()["within_observed_feature_ranges"] is False
    assert any("outside the observed training range" in warning.lower() for warning in response.json()["warnings"])


def test_soil_moisture_does_not_change_recommendations_without_training_data(farmer_client):
    dry = farmer_client.post("/api/farmer/recommend", json=request_values(soil_moisture=0)).json()
    wet = farmer_client.post("/api/farmer/recommend", json=request_values(soil_moisture=100)).json()
    assert dry["recommendations"] == wet["recommendations"]


def test_missing_model_returns_service_unavailable(farmer_client, monkeypatch, tmp_path):
    monkeypatch.setattr(api, "MODEL_DIR", tmp_path)
    monkeypatch.setattr(api, "model", None)
    monkeypatch.setattr(api, "metadata", None)
    monkeypatch.setattr(api, "loaded_stamp", None)
    with TestClient(api.app) as health_client:
        health = health_client.get("/api/health")
    recommend = farmer_client.post("/api/farmer/recommend", json=request_values())
    assert health.status_code == 503
    assert health.json()["status"] == "model_unavailable"
    assert recommend.status_code == 503


def test_trained_artifact_hash_and_version_are_persisted():
    import hashlib
    import json

    artifact = api.MODEL_DIR / "crop_model.joblib"
    metadata = json.loads((api.MODEL_DIR / "metadata.json").read_text(encoding="utf-8"))
    artifact_hash = hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert metadata["artifact_sha256"] == artifact_hash
    assert metadata["model_version"] == artifact_hash[:12]
    assert metadata["final_fit_rows"] == 2200
    assert metadata["evaluation"]["holdout_rows"] == 440
