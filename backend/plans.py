"""Public plan catalogue and admin-managed annual pricing/allowances."""
from __future__ import annotations

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


def _read_catalog(db, *, active_only: bool = False) -> list[dict]:
    query = {"active": True} if active_only else {}
    order = {key: index for index, key in enumerate(
        ("free", "basic", "plus", "premium", "organizationStarter", "organizationGrowth"))}
    rows = db.plan_catalog.find(query, {"_id": 0}).sort("key", 1)
    results = []
    for row in rows:
        item = {key: row.get(key) for key in (
            "key", "price_inr", "annual_limit", "display_name", "description", "updated_at", "active", "is_recommended")}
        item["features"] = row.get("features", [])
        results.append(item)
    return sorted(results, key=lambda item: order.get(item["key"], 99))


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
        active = db.plan_catalog.find_one({"key": plan_key}, {"active": 1})
        if not active or not active["active"]:
            raise HTTPException(404, "This plan is not currently available.")
        db.plan_selections.insert_one({"plan_key": plan_key, "selected_at": now_iso()})
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
            db.plan_catalog.update_many({}, {"$set": {"is_recommended": False}})
        for plan in payload.plans:
            update = plan.model_dump(exclude_none=True, exclude={"updated_at", "key"})
            if "features" in update:
                update["features"] = [feature.strip() for feature in update["features"]]
            if "display_name" in update:
                update["display_name"] = update["display_name"].strip()
            if "description" in update:
                update["description"] = update["description"].strip()
            update["updated_at"] = timestamp
            db.plan_catalog.update_one({"key": plan.key}, {"$set": update})
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
        db.plan_catalog.update_one({"key": plan_key}, {"$set": {"active": False, "is_recommended": False, "updated_at": now_iso()}})
        _audit(db, "admin_plan_archived", user["id"], None, {"plan_key": plan_key})
        plans = _read_catalog(db)
    return {"plans": plans}
