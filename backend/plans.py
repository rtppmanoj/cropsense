"""Public plan catalogue and admin-managed annual pricing/allowances."""
from __future__ import annotations

import json
import sqlite3
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.auth import AdminUser, _audit, _check_origin, _rate_limit, now_iso, store

router = APIRouter(prefix="/api")
PlanKey = Literal["free", "basic", "plus", "premium", "organizationStarter", "organizationGrowth"]
class PlanDetails(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: PlanKey
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, min_length=1, max_length=240)
    features: list[str] | None = Field(default=None, max_length=24)
    price_inr: int | None = Field(default=None, ge=0, le=10_000_000)
    annual_limit: int | None = Field(default=None, ge=1, le=1_000_000)
    active: bool | None = None
    is_recommended: bool | None = None
    updated_at: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def require_update(self):
        if all(getattr(self, field) is None for field in ("display_name", "description", "features", "price_inr", "annual_limit", "active", "is_recommended")):
            raise ValueError("Provide at least one plan field to update.")
        return self

class PlanCatalogUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plans: list[PlanDetails] = Field(min_length=1, max_length=6)


def _read_catalog(db: sqlite3.Connection, *, active_only: bool = False) -> list[dict]:
    results = []
    for row in db.execute(
        "SELECT plan_key AS key,price_inr,annual_limit,display_name,description,features_json,updated_at,active,is_recommended FROM plan_catalog "
        + ("WHERE active=1 " if active_only else "") + "ORDER BY CASE plan_key WHEN 'free' THEN 1 WHEN 'basic' THEN 2 WHEN 'plus' THEN 3 "
        "WHEN 'premium' THEN 4 WHEN 'organizationStarter' THEN 5 ELSE 6 END"
    ).fetchall():
        item = dict(row)
        try:
            item["features"] = json.loads(item.pop("features_json"))
        except (TypeError, json.JSONDecodeError):
            item["features"] = []
        results.append(item)
    return results


def read_public_catalog() -> list[dict]:
    from backend.auth import store as auth_store
    with auth_store.connection() as db:
        return _read_catalog(db, active_only=True)


@router.get("/plans")
def get_plans():
    return {"plans": read_public_catalog()}


@router.post("/plans/{plan_key}/select")
def record_plan_selection(plan_key: PlanKey, request: Request):
    from backend.auth import store as auth_store
    _check_origin(request)
    _rate_limit(request, "plan-selection", 20, 3600)
    with auth_store.connection() as db:
        active = db.execute("SELECT active FROM plan_catalog WHERE plan_key=?", (plan_key,)).fetchone()
        if not active or not active["active"]:
            raise HTTPException(404, "This plan is not currently available.")
        db.execute("INSERT INTO plan_selections(plan_key,selected_at) VALUES(?,?)", (plan_key, now_iso()))
    return {"recorded": True}


@router.get("/admin/plans")
def admin_get_plans(_user: AdminUser):
    from backend.auth import store as auth_store
    with auth_store.connection() as db:
        return {"plans": _read_catalog(db)}


@router.put("/admin/plans")
def admin_update_plans(payload: PlanCatalogUpdate, request: Request, user: AdminUser):
    from backend.auth import store as auth_store
    _check_origin(request)
    keys = [plan.key for plan in payload.plans]
    if len(set(keys)) != len(keys):
        raise HTTPException(422, "Submit each plan at most once.")
    if any(not feature.strip() or len(feature.strip()) > 100 for plan in payload.plans for feature in (plan.features or [])):
        raise HTTPException(422, "Each feature must contain between 1 and 100 characters.")

    if any(plan.key == "free" and plan.active is False for plan in payload.plans):
        raise HTTPException(422, "The Free plan is required for farmer accounts and cannot be deleted.")
    if any(plan.active is False and plan.is_recommended is True for plan in payload.plans):
        raise HTTPException(422, "An unavailable plan cannot be marked as recommended.")
    allowed_features = {
        "cropRecommendations", "weatherOutlook", "governmentSchemes", "onlineResults", "fertilizerRecommendations",
        "pdfDownload", "emailReports", "eligibilityGuidance", "savedHistory",
        "marketPriceInsights", "disasterAssistance", "higherQuota", "chatbotFeature", "weatherContext", "onlineResultsReports",
    }
    organization_features = {"cropRecommendations", "weatherContext", "onlineResultsReports"}
    for plan in payload.plans:
        allowed = organization_features if plan.key in {"organizationStarter", "organizationGrowth"} else allowed_features - organization_features
        if plan.features is not None and any(feature not in allowed for feature in plan.features):
            raise HTTPException(422, "Choose features from the supported plan feature list.")
    recommended = [plan.key for plan in payload.plans if plan.is_recommended is True]
    if any(key not in {"free", "basic", "plus", "premium"} for key in recommended):
        raise HTTPException(422, "Only a farmer plan can be marked as recommended.")
    timestamp = now_iso()
    changes = [plan.model_dump(exclude_none=True, exclude={"updated_at"}) for plan in payload.plans]
    with auth_store.connection() as db:
        if recommended:
            db.execute("UPDATE plan_catalog SET is_recommended=0")
        db.executemany(
            "UPDATE plan_catalog SET display_name=COALESCE(?,display_name),description=COALESCE(?,description),"
            "features_json=COALESCE(?,features_json),price_inr=COALESCE(?,price_inr),"
            "annual_limit=COALESCE(?,annual_limit),active=COALESCE(?,active),"
            "is_recommended=COALESCE(?,is_recommended),updated_at=? WHERE plan_key=?",
            [(plan.display_name.strip() if plan.display_name is not None else None,
              plan.description.strip() if plan.description is not None else None,
              json.dumps([feature.strip() for feature in plan.features]) if plan.features is not None else None,
              plan.price_inr, plan.annual_limit, plan.active, plan.is_recommended, timestamp, plan.key) for plan in payload.plans],
        )
        _audit(db, "admin_plan_catalog_updated", user["id"], None, {"plans": changes})
        plans = _read_catalog(db)
    return {"plans": plans}


@router.delete("/admin/plans/{plan_key}")
def admin_delete_plan(plan_key: PlanKey, request: Request, user: AdminUser):
    from backend.auth import store as auth_store
    _check_origin(request)
    if plan_key == "free":
        raise HTTPException(422, "The Free plan is required for new farmer accounts and cannot be deleted.")
    with auth_store.connection() as db:
        db.execute("UPDATE plan_catalog SET active=0,is_recommended=0,updated_at=? WHERE plan_key=?", (now_iso(), plan_key))
        _audit(db, "admin_plan_archived", user["id"], None, {"plan_key": plan_key})
        plans = _read_catalog(db)
    return {"plans": plans}
