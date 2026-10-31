from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient

from backend import api, auth, auth_admin
from backend.auth_store import AuthStore


@pytest.fixture
def auth_client(tmp_path, monkeypatch):
    store = AuthStore(tmp_path / "test-auth.sqlite3")
    monkeypatch.setattr(auth, "store", store)
    monkeypatch.setattr(api, "auth_store", store)
    with auth._rate_lock:
        auth._requests.clear()
    with TestClient(api.app) as client:
        yield client, store


def register(client: TestClient, email: str):
    response = client.post("/api/auth/farmer/register", json={"email": email, "password": "farmersafe-pass-123", "display_name": "Test Farmer", "mobile_number": "+919876543210"})
    assert response.status_code == 201, response.text
    return response.json()["user"]


def provision_admin(monkeypatch, store: AuthStore):
    monkeypatch.setenv("CROPSENSE_DB_PATH", str(store.db_path))
    monkeypatch.setenv("CROPSENSE_ADMIN_EMAIL", "admin@example.test")
    monkeypatch.setenv("CROPSENSE_ADMIN_PASSWORD", "admin-safe-pass-12345")
    auth_admin.provision_admin()


def test_farmer_registration_hashes_password_and_rejects_privilege_escalation(auth_client):
    client, store = auth_client
    response = client.post("/api/auth/farmer/register", json={"email": "FARMER@example.test", "password": "farmersafe-pass-123", "display_name": "Farmer", "mobile_number": "9876543210", "role": "admin"})
    assert response.status_code == 422  # Extra role fields are forbidden.
    response = client.post("/api/auth/farmer/register", json={"email": "FARMER@example.test", "password": "farmersafe-pass-123", "display_name": "Farmer", "mobile_number": "9876543210"})
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "farmer"
    with store.connection() as db:
        row = db.execute("SELECT password_hash,role FROM users WHERE email=?", ("farmer@example.test",)).fetchone()
    assert row["role"] == "farmer"
    assert row["password_hash"] != "farmersafe-pass-123"
    assert PasswordHasher().verify(row["password_hash"], "farmersafe-pass-123")
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/api" in cookie and "max-age=" in cookie
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/admin/register", json={}).status_code == 404
    assert client.get("/api/admin/overview").status_code == 403


def test_eight_character_password_is_accepted(auth_client):
    client, _ = auth_client
    response = client.post("/api/auth/farmer/register", json={"email": "eight@example.test", "password": "Farmer12", "display_name": "Test Farmer", "mobile_number": "9876543210"})
    assert response.status_code == 201, response.text


def test_single_login_routes_by_stored_role_and_admin_provisioning(auth_client, monkeypatch):
    client, store = auth_client
    register(client, "farmer@example.test")
    client.post("/api/auth/logout", json={})
    farmer_login = client.post("/api/auth/login", json={"email": "farmer@example.test", "password": "farmersafe-pass-123"})
    assert farmer_login.status_code == 200 and farmer_login.json()["user"]["role"] == "farmer"
    client.post("/api/auth/logout", json={})
    provision_admin(monkeypatch, store)
    response = client.post("/api/auth/login", json={"email": "admin@example.test", "password": "admin-safe-pass-12345"})
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"
    assert client.get("/api/admin/overview").status_code == 200
    assert client.get("/api/farmer/history").status_code == 403
    system = client.get("/api/admin/system").json()
    assert system["model"]["status"] == "ready"
    assert system["model"]["evaluation"]["holdout_macro_f1"] > 0
    assert system["sources"] and system["sources"][0]["available"] is True


def test_logout_revokes_cookie_session_and_session_expiry_is_enforced(auth_client):
    client, store = auth_client
    register(client, "farmer@example.test")
    assert client.post("/api/auth/logout", json={}).status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    client.post("/api/auth/login", json={"email": "farmer@example.test", "password": "farmersafe-pass-123"})
    with store.connection() as db:
        db.execute("UPDATE sessions SET expires_at=?", ((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),))
    assert client.get("/api/farmer/history").status_code == 401


def test_farmer_history_is_private_and_admin_can_view_activity(auth_client):
    client, store = auth_client
    first = register(client, "first@example.test")
    payload = {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88, "humidity": 82, "ph": 6.5, "soil_moisture": 44, "location_name": "Farm near Chennai", "village_town": "Chennai", "farm_district": "Chennai", "farm_state": "Tamil Nadu", "land_area_acres": 1, "latitude": 13.08, "longitude": 80.27, "location_source": "map"}
    prediction = client.post("/api/farmer/recommend", json=payload)
    assert prediction.status_code == 200, prediction.text
    assert len(prediction.json()["recommendations"]) == 5
    history_page = client.get("/api/farmer/history?limit=10&offset=0").json()
    assert len(history_page["items"]) == 1 and history_page["total"] == 1
    saved = history_page["items"][0]
    assert client.get("/api/farmer/history?limit=11&offset=0").status_code == 422
    assert saved["location_name"] == "Farm near Chennai" and saved["latitude"] == 13.08
    assert (saved["village_town"], saved["farm_district"], saved["farm_state"]) == ("Chennai", "Chennai", "Tamil Nadu")
    assert set(saved["inputs"]) == {"nitrogen", "phosphorus", "potassium", "temperature", "humidity", "ph", "soil_moisture"}
    client.post("/api/auth/logout", json={})
    second = register(client, "second@example.test")
    assert first["id"] != second["id"]
    assert client.get("/api/farmer/history").json()["items"] == []
    assert client.patch(f"/api/admin/farmers/{first['id']}/status", json={"active": False}).status_code == 403


def test_recommendation_report_id_recovers_from_stale_counter(auth_client):
    client, store = auth_client
    farmer = register(client, "report-sequence@example.test")
    with store.connection() as db:
        db.execute("""INSERT INTO recommendation_history
            (id,user_id,report_number,created_at,input_json,recommendations_json,model_name,model_version,location_name)
            VALUES('existing-report',?,7,?,'{}','[]','test-model','1','Test location')""",
                   (farmer["id"], datetime.now(timezone.utc).isoformat()))
        db.execute("INSERT INTO farmer_report_counters(user_id,last_report_number) VALUES(?,2)", (farmer["id"],))

    payload = {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88,
               "humidity": 82, "ph": 6.5, "soil_moisture": 44, "location_name": "Farm near Chennai",
               "village_town": "Chennai", "farm_district": "Chennai", "farm_state": "Tamil Nadu",
               "land_area_acres": 1, "latitude": 13.08, "longitude": 80.27, "location_source": "map"}
    response = client.post("/api/farmer/recommend", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["report_id"] == "00008"


def test_admin_login_purges_records_older_than_retention_and_overview_shows_today(auth_client, monkeypatch):
    client, store = auth_client
    farmer = register(client, "retention@example.test")
    now = datetime.now(timezone.utc)
    old = (now - timedelta(days=auth.RECOMMENDATION_RETENTION_DAYS + 1)).isoformat()
    with store.connection() as db:
        db.execute("""INSERT INTO recommendation_history
            (id,user_id,report_number,created_at,input_json,recommendations_json,model_name,model_version,location_name)
            VALUES('expired-recommendation',?,1,?,'{}','[{\"crop\":\"rice\",\"score\":0.9}]','test-model','1','Old location')""",
                   (farmer["id"], old))
        db.execute("""INSERT INTO recommendation_history
            (id,user_id,report_number,created_at,input_json,recommendations_json,model_name,model_version,location_name)
            VALUES('todays-recommendation',?,2,?,'{}','[{\"crop\":\"maize\",\"score\":0.8}]','test-model','1','Current location')""",
                   (farmer["id"], now.isoformat()))
        db.execute("INSERT INTO farmer_report_counters(user_id,last_report_number) VALUES(?,2)", (farmer["id"],))
        auth._audit(db, "recommendation_created", farmer["id"], farmer["id"],
                    {"record_id": "expired-recommendation", "location_name": "Old location", "land_area_acres": 1})
    client.post("/api/auth/logout", json={})
    provision_admin(monkeypatch, store)
    login = client.post("/api/auth/login", json={"email": "admin@example.test", "password": "admin-safe-pass-12345"})
    assert login.status_code == 200
    with store.connection() as db:
        assert db.execute("SELECT COUNT(*) FROM recommendation_history").fetchone()[0] == 1
        assert db.execute("SELECT id FROM recommendation_history").fetchone()[0] == "todays-recommendation"
        assert db.execute("SELECT COUNT(*) FROM audit_logs WHERE action='recommendation_created'").fetchone()[0] == 0
        assert db.execute("SELECT last_report_number FROM farmer_report_counters WHERE user_id=?", (farmer["id"],)).fetchone()[0] == 2
    overview = client.get("/api/admin/overview").json()
    assert overview["recommendations_today"] == 1
    assert overview["today_recommendations"][0]["id"] == "todays-recommendation"
    assert overview["today_recommendations"][0]["report_id"] == "00002"
    assert overview["top_crops_30_days"] == [{"crop": "maize", "count": 1}]


def test_farmer_scheme_catalog_tracking_and_ownership(auth_client):
    client, store = auth_client
    owner = register(client, "scheme-owner@example.test")
    with store.connection() as db:
        db.execute("""INSERT INTO recommendation_history
            (id,user_id,created_at,input_json,recommendations_json,model_name,model_version,location_name,
             latitude,longitude,location_source,land_area_acres,village_town,farm_district,farm_state)
            VALUES('scheme-context',?,?,'{}','[{\"crop\":\"rice\"}]','test-model','1','Village, District, State',
                   NULL,NULL,'manual',2.0,'Village','District','State')""",
                   (owner["id"], datetime.now(timezone.utc).isoformat()))

    catalog = client.get("/api/farmer/schemes")
    assert catalog.status_code == 200
    assert catalog.json()["farmer_context"]["farm_state"] == "State"
    assert catalog.json()["farmer_context"]["crops"] == ["rice"]
    schemes = {scheme["id"]: scheme for scheme in catalog.json()["items"]}
    assert {"pm-kisan", "pmfby"}.issubset(schemes)
    assert schemes["pmfby"]["verified_at"]
    assert schemes["pmfby"]["saved"] is False

    saved = client.put("/api/farmer/schemes/pmfby", json={})
    assert saved.status_code == 200 and saved.json()["saved"] is True
    updated = client.patch("/api/farmer/schemes/pmfby/status", json={"application_status": "preparing"})
    assert updated.status_code == 200
    assert client.get("/api/farmer/schemes").json()["items"][1]["application_status"] == "preparing"
    assert client.patch("/api/farmer/schemes/pmfby/status", json={"application_status": "invalid"}).status_code == 422
    assert client.put("/api/farmer/schemes/unknown", json={}).status_code == 404

    client.post("/api/auth/logout", json={})
    register(client, "scheme-other@example.test")
    own_catalog = client.get("/api/farmer/schemes").json()
    assert all(not scheme["saved"] for scheme in own_catalog["items"])
    assert client.patch("/api/farmer/schemes/pmfby/status", json={"application_status": "applied"}).status_code == 404
    assert client.delete("/api/farmer/schemes/pmfby", headers={"Content-Type": "application/json"}).status_code == 204
    assert client.get("/api/farmer/schemes").json()["items"][1]["saved"] is False


def test_scheme_routes_require_farmer_authentication(auth_client):
    client, _ = auth_client
    assert client.get("/api/farmer/schemes").status_code == 401
    register(client, "scheme-farmer@example.test")
    client.post("/api/auth/logout", json={})


def test_location_requires_a_valid_coordinate_pair_when_map_is_selected(auth_client):
    client, _ = auth_client
    register(client, "farmer@example.test")
    payload = {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88, "humidity": 82, "ph": 6.5, "soil_moisture": 44,
               "location_name": "Farm near Chennai", "village_town": "Chennai", "farm_district": "Chennai", "farm_state": "Tamil Nadu", "land_area_acres": 1, "latitude": 13.08, "location_source": "map"}
    assert client.post("/api/farmer/recommend", json=payload).status_code == 422
    payload["longitude"] = 181
    assert client.post("/api/farmer/recommend", json=payload).status_code == 422


def test_admin_can_suspend_farmer_and_suspension_revokes_existing_session(auth_client, monkeypatch):
    client, store = auth_client
    farmer = register(client, "farmer@example.test")
    farmer_cookie = client.cookies.get(auth.COOKIE_NAME)
    payload = {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88, "humidity": 82, "ph": 6.5, "soil_moisture": 44, "location_name": "Coimbatore field", "village_town": "Coimbatore", "farm_district": "Coimbatore", "farm_state": "Tamil Nadu", "land_area_acres": 1}
    assert client.post("/api/farmer/recommend", json=payload).status_code == 200
    client.post("/api/auth/logout", json={})
    provision_admin(monkeypatch, store)
    client.post("/api/auth/login", json={"email": "admin@example.test", "password": "admin-safe-pass-12345"})
    overview = client.get("/api/admin/overview").json()
    assert overview["farmers_total"] == 1
    assert overview["users_logged_in"] == 1
    assert overview["users_currently_signed_in"] == 1
    assert overview["recommendation_form_submissions"] == 1
    activity = client.get("/api/admin/activity").json()
    assert activity["items"]
    suspension = client.patch(f"/api/admin/farmers/{farmer['id']}/status", json={"active": False})
    assert suspension.status_code == 200 and suspension.json()["user"]["active"] is False
    assert client.get("/api/admin/audit").json()["items"]
    client.cookies.set(auth.COOKIE_NAME, farmer_cookie, path="/api")
    assert client.get("/api/farmer/profile").status_code == 401


def test_password_change_revokes_other_sessions_and_updates_credentials(auth_client):
    client, store = auth_client
    register(client, "farmer@example.test")
    second_session = TestClient(api.app)
    assert second_session.post("/api/auth/login", json={"email": "farmer@example.test", "password": "farmersafe-pass-123"}).status_code == 200
    response = client.post("/api/farmer/password", json={"current_password": "incorrect-password", "new_password": "another-safe-pass-123"})
    assert response.status_code == 400
    response = client.post("/api/farmer/password", json={"current_password": "farmersafe-pass-123", "new_password": "another-safe-pass-123"})
    assert response.status_code == 200
    assert client.get("/api/farmer/profile").status_code == 200
    assert second_session.get("/api/auth/me").status_code == 401
    client.post("/api/auth/logout", json={})
    assert client.post("/api/auth/login", json={"email": "farmer@example.test", "password": "another-safe-pass-123"}).status_code == 200


def test_auth_mutations_reject_untrusted_browser_origins(auth_client):
    client, _ = auth_client
    response = client.post("/api/auth/farmer/register", headers={"Origin": "https://attacker.example", "Content-Type": "application/json"},
                           json={"email": "farmer@example.test", "password": "farmersafe-pass-123", "display_name": "Farmer", "mobile_number": "9876543210"})
    assert response.status_code == 403


def test_vite_loopback_origin_with_an_alternate_dev_port_is_allowed(auth_client):
    client, _ = auth_client
    response = client.post("/api/auth/farmer/register", headers={"Origin": "http://localhost:5174", "Content-Type": "application/json"},
                           json={"email": "vite@example.test", "password": "Farmer12", "display_name": "Vite Farmer", "mobile_number": "9876543210"})
    assert response.status_code == 201, response.text
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5174"


def test_loopback_dev_origin_is_not_allowed_in_production(auth_client, monkeypatch):
    client, _ = auth_client
    monkeypatch.setenv("CROPSENSE_ENV", "production")
    response = client.post("/api/auth/farmer/register", headers={"Origin": "http://localhost:5174", "Content-Type": "application/json"},
                           json={"email": "prod@example.test", "password": "Farmer12", "display_name": "Test Farmer", "mobile_number": "9876543210"})
    assert response.status_code == 403



def test_farmer_weather_uses_latest_saved_location_and_handles_missing_history(auth_client, monkeypatch):
    client, _ = auth_client
    register(client, "weather@example.test")
    assert client.get("/api/farmer/weather").status_code == 422
    payload = {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88, "humidity": 82,
               "ph": 6.5, "soil_moisture": 44, "location_name": "Coimbatore, Coimbatore, Tamil Nadu",
               "village_town": "Coimbatore", "farm_district": "Coimbatore", "farm_state": "Tamil Nadu",
               "land_area_acres": 1, "latitude": 11.0, "longitude": 76.0, "location_source": "google"}
    assert client.post("/api/farmer/recommend", json=payload).status_code == 200
    from backend import weather
    called = {}
    def fake(village, district, state, latitude, longitude):
        called.update(village=village, district=district, state=state, latitude=latitude, longitude=longitude)
        return {"forecast": [], "historical_monthly": []}
    monkeypatch.setattr(weather, "get_location_weather", fake)
    response = client.get("/api/farmer/weather", params={"village_town": "Coimbatore", "farm_district": "Coimbatore", "farm_state": "Tamil Nadu", "latitude": 11.0, "longitude": 76.0})
    assert response.status_code == 200
    assert called == {"village": "Coimbatore", "district": "Coimbatore", "state": "Tamil Nadu", "latitude": 11.0, "longitude": 76.0}


def test_farmer_weather_provider_and_location_errors_are_graceful(auth_client, monkeypatch):
    client, _ = auth_client
    register(client, "weather-errors@example.test")
    payload = {"nitrogen": 90, "phosphorus": 42, "potassium": 43, "temperature": 20.88, "humidity": 82,
               "ph": 6.5, "soil_moisture": 44, "location_name": "Coimbatore", "village_town": "Coimbatore",
               "farm_district": "Coimbatore", "farm_state": "Tamil Nadu", "land_area_acres": 1}
    assert client.post("/api/farmer/recommend", json=payload).status_code == 200
    from backend import weather
    monkeypatch.setattr(weather, "get_location_weather", lambda *args: (_ for _ in ()).throw(weather.LocationAmbiguous("ambiguous")))
    params = {"village_town": "Coimbatore", "farm_district": "Coimbatore", "farm_state": "Tamil Nadu"}
    assert client.get("/api/farmer/weather", params=params).status_code == 409
    monkeypatch.setattr(weather, "get_location_weather", lambda *args: (_ for _ in ()).throw(weather.WeatherProviderError("offline")))
    assert client.get("/api/farmer/weather", params=params).status_code == 503


class MockSMTP:
    messages = []
    def __init__(self, *args, **kwargs):
        self.args = args
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def ehlo(self): pass
    def starttls(self, **kwargs): pass
    def login(self, *args): pass
    def send_message(self, message): self.messages.append(message)


def test_farmer_password_reset_uses_email_otp_and_invalidates_sessions(auth_client, monkeypatch):
    from backend import email_report
    client, store = auth_client
    farmer = register(client, "reset-farmer@example.test")
    MockSMTP.messages.clear()
    monkeypatch.setenv("SMTP_EMAIL", "cropsensevit@gmail.com")
    monkeypatch.setenv("SMTP_APP_PASSWORD", "mock-app-password")
    monkeypatch.setattr(email_report.smtplib, "SMTP", MockSMTP)
    response = client.post("/api/auth/password-reset/request", json={"email": "RESET-FARMER@example.test"})
    assert response.status_code == 202
    assert "If an active farmer account" in response.json()["message"]
    msg = MockSMTP.messages[-1]
    import re
    otp = re.search(r"\b(\d{6})\b", msg.get_content()).group(1)
    wrong_otp = "000000" if otp != "000000" else "000001"
    assert msg["To"] == "reset-farmer@example.test"
    assert client.post("/api/auth/password-reset/complete", json={"email": "reset-farmer@example.test", "otp": wrong_otp, "new_password": "NewFarmerPass-456"}).status_code == 400
    completed = client.post("/api/auth/password-reset/complete", json={"email": "reset-farmer@example.test", "otp": otp, "new_password": "NewFarmerPass-456"})
    assert completed.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "reset-farmer@example.test", "password": "NewFarmerPass-456"}).status_code == 200
    with store.connection() as db:
        assert db.execute("SELECT COUNT(*) FROM farmer_password_resets WHERE user_id=? AND consumed_at IS NOT NULL", (farmer["id"],)).fetchone()[0] == 1


def test_password_reset_does_not_send_for_admin_account(auth_client, monkeypatch):
    from backend import email_report
    client, store = auth_client
    provision_admin(monkeypatch, store)
    monkeypatch.setenv("SMTP_EMAIL", "cropsensevit@gmail.com")
    monkeypatch.setenv("SMTP_APP_PASSWORD", "mock-app-password")
    MockSMTP.messages.clear()
    monkeypatch.setattr(email_report.smtplib, "SMTP", MockSMTP)
    response = client.post("/api/auth/password-reset/request", json={"email": "admin@example.test"})
    assert response.status_code == 202
    assert MockSMTP.messages == []
    assert client.post("/api/auth/password-reset/complete", json={"email": "admin@example.test", "otp": "123456", "new_password": "NewFarmerPass-456"}).status_code == 400
