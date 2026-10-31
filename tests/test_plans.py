from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend import api, auth, auth_admin
from backend.auth_store import AuthStore


@pytest.fixture
def plan_client(tmp_path, monkeypatch):
    db = AuthStore(tmp_path / "plans.sqlite3")
    monkeypatch.setattr(auth, "store", db)
    monkeypatch.setattr(api, "auth_store", db)
    with auth._rate_lock:
        auth._requests.clear()
    with TestClient(api.app) as client:
        yield client, db


def _provision_admin(monkeypatch, db: AuthStore):
    monkeypatch.setenv("CROPSENSE_DB_PATH", str(db.db_path))
    monkeypatch.setenv("CROPSENSE_ADMIN_EMAIL", "plans-admin@example.test")
    monkeypatch.setenv("CROPSENSE_ADMIN_PASSWORD", "safe-plan-admin-pass")
    auth_admin.provision_admin()


def test_public_plan_catalog_has_increased_prices_and_limits(plan_client):
    client, _ = plan_client
    response = client.get("/api/plans")
    assert response.status_code == 200
    assert [(plan["key"], plan["price_inr"], plan["annual_limit"]) for plan in response.json()["plans"]] == [
        ("free", 0, 3), ("basic", 49, 5), ("plus", 149, 15),
        ("premium", 399, 50), ("organizationStarter", 999, 500),
        ("organizationGrowth", 2499, 2000),
    ]


def test_only_admin_can_update_plan_catalog(plan_client, monkeypatch):
    client, db = plan_client
    farmer = client.post("/api/auth/farmer/register", json={
        "email": "plan-farmer@example.test", "password": "farmer-safe-pass-123",
        "display_name": "Plan Farmer", "mobile_number": "9876543210",
    })
    assert farmer.status_code == 201
    plans = client.get("/api/plans").json()["plans"]
    assert client.put("/api/admin/plans", json={"plans": plans}).status_code == 403

    client.post("/api/auth/logout", json={})
    _provision_admin(monkeypatch, db)
    assert client.post("/api/auth/login", json={
        "email": "plans-admin@example.test", "password": "safe-plan-admin-pass",
    }).status_code == 200
    updated = [{"key": plan["key"], "price_inr": plan["price_inr"] + (10 if plan["key"] == "basic" else 0), "annual_limit": plan["annual_limit"]} for plan in plans]
    response = client.put("/api/admin/plans", json={"plans": updated})
    assert response.status_code == 200, response.text
    basic = next(plan for plan in client.get("/api/plans").json()["plans"] if plan["key"] == "basic")
    assert basic["price_inr"] == 59
    assert basic["annual_limit"] == 5


def test_plan_catalog_rejects_duplicate_keys_and_invalid_values(plan_client, monkeypatch):
    client, db = plan_client
    _provision_admin(monkeypatch, db)
    client.post("/api/auth/login", json={
        "email": "plans-admin@example.test", "password": "safe-plan-admin-pass",
    })
    plans = client.get("/api/plans").json()["plans"]
    duplicated = [{key: plan[key] for key in ("key", "price_inr", "annual_limit")} for plan in [*plans[:-1], plans[0]]]
    assert client.put("/api/admin/plans", json={"plans": duplicated}).status_code == 422
    invalid = [{"key": plan["key"], "price_inr": plan["price_inr"], "annual_limit": 0 if plan["key"] == "basic" else plan["annual_limit"]} for plan in plans]
    assert client.put("/api/admin/plans", json={"plans": invalid}).status_code == 422


def test_admin_can_manage_recommended_and_remove_public_plan(plan_client, monkeypatch):
    client, db = plan_client
    _provision_admin(monkeypatch, db)
    login = client.post("/api/auth/login", json={
        "email": "plans-admin@example.test", "password": "safe-plan-admin-pass",
    })
    assert login.status_code == 200

    initial = client.get("/api/plans").json()["plans"]
    assert next(plan for plan in initial if plan["key"] == "plus")["is_recommended"] == 1
    update = client.put("/api/admin/plans", json={"plans": [{"key": "basic", "is_recommended": True}]})
    assert update.status_code == 200, update.text
    public = client.get("/api/plans").json()["plans"]
    assert next(plan for plan in public if plan["key"] == "basic")["is_recommended"] == 1
    assert not any(plan["is_recommended"] for plan in public if plan["key"] != "basic")

    deleted = client.delete("/api/admin/plans/basic")
    assert deleted.status_code == 200
    assert "basic" not in {plan["key"] for plan in client.get("/api/plans").json()["plans"]}
    admin_catalogue = client.get("/api/admin/plans").json()["plans"]
    assert next(plan for plan in admin_catalogue if plan["key"] == "basic")["active"] == 0
    assert client.post("/api/plans/basic/select").status_code == 404
    assert client.delete("/api/admin/plans/free").status_code == 422


def test_admin_plan_features_accept_only_supported_feature_keys(plan_client, monkeypatch):
    client, db = plan_client
    _provision_admin(monkeypatch, db)
    client.post("/api/auth/login", json={
        "email": "plans-admin@example.test", "password": "safe-plan-admin-pass",
    })
    response = client.put("/api/admin/plans", json={"plans": [{"key": "basic", "features": ["madeUpFeature"]}]})
    assert response.status_code == 422
