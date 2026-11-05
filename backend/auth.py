"""Role-based cookie authentication and private farmer records for CropSense."""
from __future__ import annotations

import json
import hashlib
import logging
import os
import re
import secrets
import threading
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import urlsplit
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated
from zoneinfo import ZoneInfo

import yaml
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo import ReturnDocument

from backend.auth_store import AuthStore, DB_INTEGRITY_ERRORS, json_document, token_digest
from backend.schemas import CropInput, Credentials, FarmerRecommendationRequest, FarmerRegistration, FarmerStatusUpdate, PasswordChange, ProfileUpdate, SchemeStatusUpdate

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
store = AuthStore()
password_hasher = PasswordHasher()
RECOMMENDATION_RETENTION_DAYS = 90
DUMMY_PASSWORD_HASH = password_hasher.hash("CropSense dummy credential never accepted")


COOKIE_NAME = "cropsense_session"
try:
    SESSION_HOURS = max(1, min(24 * 30, int(os.getenv("CROPSENSE_SESSION_HOURS", "8"))))
except ValueError:
    SESSION_HOURS = 8
COOKIE_SECURE = os.getenv("CROPSENSE_COOKIE_SECURE", "").lower() in {"1", "true", "yes"} or os.getenv("CROPSENSE_ENV", "development").lower() == "production"
_rate_lock = threading.Lock()
_requests: dict[str, deque[float]] = defaultdict(deque)


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class PasswordResetComplete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    otp: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _purge_expired_recommendations(db, now: datetime | None = None) -> int:
    cutoff = ((now or datetime.now(timezone.utc)) - timedelta(days=RECOMMENDATION_RETENTION_DAYS)).isoformat()
    expired_ids = [row["id"] for row in db.recommendation_history.find(
        {"created_at": {"$lt": cutoff}}, {"id": 1})]
    if not expired_ids:
        return 0
    deleted = db.recommendation_history.delete_many({"id": {"$in": expired_ids}}).deleted_count
    db.audit_logs.delete_many({"action": "recommendation_created", "detail.record_id": {"$in": expired_ids}})
    return deleted


def _local_day_bounds_utc(now: datetime | None = None) -> tuple[str, str, datetime]:
    local_now = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("Asia/Kolkata"))
    local_day = local_now.date()
    local_start = datetime.combine(local_day, datetime.min.time(), tzinfo=ZoneInfo("Asia/Kolkata"))
    local_end = local_start + timedelta(days=1)
    return local_start.astimezone(timezone.utc).isoformat(), local_end.astimezone(timezone.utc).isoformat(), local_now


def _rate_limit(request: Request, bucket: str, limit: int, window: int) -> None:
    now = time.monotonic()
    identity = request.client.host if request.client else "unknown"
    key = f"{bucket}:{identity}"
    with _rate_lock:
        recent = _requests[key]
        while recent and recent[0] <= now - window:
            recent.popleft()
        if len(recent) >= limit:
            raise HTTPException(429, "Too many attempts. Please wait before trying again.", headers={"Retry-After": str(window)})
        recent.append(now)


def _check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    configured = {item.strip().rstrip("/") for item in os.getenv(
        "CROPSENSE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if item.strip()}
    configured.add("https://worshiper-valuables-slacks.ngrok-free.dev")
    try:
        parts = urlsplit(origin)
        loopback_dev_origin = (os.getenv("CROPSENSE_ENV", "development").lower() != "production"
                               and parts.scheme == "http" and parts.hostname in {"localhost", "127.0.0.1"}
                               and parts.username is None and parts.password is None and not parts.path
                               and not parts.query and not parts.fragment)
    except ValueError:
        loopback_dev_origin = False
    if origin.rstrip("/") not in configured and not loopback_dev_origin:
        raise HTTPException(403, "Request origin is not allowed.")
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
        raise HTTPException(415, "Use application/json for account actions.")


def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token or len(token) > 256:
        raise HTTPException(401, "Authentication required.")
    with store.connection() as db:
        session = db.sessions.find_one({"token_hash": token_digest(token), "revoked_at": None})
        row = db.users.find_one({"id": session["user_id"]}) if session else None
        if row and session:
            row = {**row, "session_id": session["id"], "expires_at": session["expires_at"]}
    if not row:
        raise HTTPException(401, "Your session is no longer valid. Please sign in again.")
    if not row["active"]:
        raise HTTPException(401, "This account is currently unavailable. Contact CropSense support.")
    if row["expires_at"] <= now_iso():
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return dict(row)


CurrentUser = Annotated[dict, Depends(current_user)]


def require_role(role: str):
    def dependency(user: CurrentUser) -> dict:
        if user["role"] != role:
            raise HTTPException(403, "This account does not have permission to access this resource.")
        return user
    return dependency


AdminUser = Annotated[dict, Depends(require_role("admin"))]
FarmerUser = Annotated[dict, Depends(require_role("farmer"))]


@router.get("/farmer/geocode")
def farmer_geocode(q: Annotated[str, Query(min_length=3, max_length=200)], request: Request, user: FarmerUser):
    """Resolve a farmer's typed place through Google Geocoding; the key stays server-side."""
    _rate_limit(request, "farmer-geocode", 20, 3600)
    key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Google Maps geocoding is not configured. Set GOOGLE_MAPS_API_KEY on the API server.")
    url = "https://maps.googleapis.com/maps/api/geocode/json?" + urllib.parse.urlencode({"address": q, "region": "in", "key": key})
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Google Maps could not resolve this location. Try a more specific address.") from exc
    if result.get("status") != "OK" or not result.get("results"):
        raise HTTPException(status_code=422, detail="No matching location found. Add a village, district, or state and try again.")
    match = result["results"][0]
    point = match["geometry"]["location"]
    components = match.get("address_components", [])
    state = next((part["long_name"] for part in components if "administrative_area_level_1" in part.get("types", [])), "")
    district = next((part["long_name"] for part in components if "administrative_area_level_2" in part.get("types", [])), "")
    return {"latitude": point["lat"], "longitude": point["lng"], "formatted_address": match["formatted_address"],
            "state": state, "district": district}


def _audit(db, action: str, actor: str | None = None,
           target: str | None = None, detail: dict | None = None) -> None:
    db.audit_logs.insert_one({"id": str(uuid.uuid4()), "actor_user_id": actor, "action": action,
                              "target_user_id": target, "detail": detail or {}, "created_at": now_iso()})


def _safe_user(row: dict) -> dict:
    return {"id": row["id"], "email": row["email"], "display_name": row["display_name"],
            "farmer_id": row["farmer_id"] if row["role"] == "farmer" else None,
            "mobile_number": row["mobile_number"], "role": row["role"], "active": bool(row["active"]), "created_at": row["created_at"]}


def _farmer_id(user_id: str) -> str:
    """Create a readable, stable public identifier without exposing the full account UUID."""
    return f"CSF-{user_id.replace('-', '')[:12].upper()}"


def _start_session(response: Response, user_id: str) -> None:
    raw_token = secrets.token_urlsafe(48)
    created = datetime.now(timezone.utc)
    expires = created + timedelta(hours=SESSION_HOURS)
    with store.connection() as db:
        db.sessions.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "token_hash": token_digest(raw_token),
                                "created_at": created.isoformat(), "expires_at": expires.isoformat(), "revoked_at": None})
    response.set_cookie(COOKIE_NAME, raw_token, max_age=SESSION_HOURS * 3600, expires=expires,
                        httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/api")


def _login(request: Request, response: Response, credentials: Credentials) -> dict:
    _check_origin(request)
    _rate_limit(request, "login", 10, 300)
    with store.connection() as db:
        row = db.users.find_one({"email": credentials.email})
        verified = False
        try:
            verified = password_hasher.verify(row["password_hash"] if row else DUMMY_PASSWORD_HASH, credentials.password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            verified = False
        if not row or not verified or not row["active"]:
            raise HTTPException(401, "Email or password is incorrect, or this account is unavailable.")
        user = _safe_user(row)
        if user["role"] == "admin":
            purged = _purge_expired_recommendations(db)
            if purged:
                _audit(db, "recommendation_retention_purged", row["id"], None,
                       {"deleted_count": purged, "retention_days": RECOMMENDATION_RETENTION_DAYS})
        _audit(db, f"{user['role']}_login", row["id"], row["id"])
    _start_session(response, user["id"])
    return {"user": user, "expires_in": SESSION_HOURS * 3600}


@router.post("/auth/farmer/register", status_code=201)
def farmer_register(payload: FarmerRegistration, request: Request, response: Response):
    _check_origin(request)
    _rate_limit(request, "farmer-register", 5, 3600)
    created = now_iso()
    user_id = str(uuid.uuid4())
    farmer_id = _farmer_id(user_id)
    digest = password_hasher.hash(payload.password)
    try:
        with store.connection() as db:
            db.users.insert_one({"id": user_id, "farmer_id": farmer_id, "email": payload.email,
                "display_name": payload.display_name, "mobile_number": payload.mobile_number,
                "password_hash": digest, "role": "farmer", "active": True,
                "created_at": created, "updated_at": created})
            _audit(db, "farmer_registered", user_id, user_id)
    except DB_INTEGRITY_ERRORS as exc:
        raise HTTPException(409, "An account with that email already exists.") from exc
    _start_session(response, user_id)
    return {"user": {"id": user_id, "farmer_id": farmer_id, "email": payload.email, "display_name": payload.display_name, "mobile_number": payload.mobile_number,
                      "role": "farmer", "active": True, "created_at": created}, "expires_in": SESSION_HOURS * 3600}


@router.post("/auth/password-reset/request", status_code=202)
def request_farmer_password_reset(payload: PasswordResetRequest, request: Request):
    _check_origin(request)
    _rate_limit(request, "farmer-password-reset-request", 3, 3600)
    email_api_key = os.getenv("BREVO_API_KEY", "").strip()
    sender_email = os.getenv("BREVO_SENDER_EMAIL", "").strip()
    sender_name = os.getenv("BREVO_SENDER_NAME", "CropSense").strip() or "CropSense"
    if not email_api_key or not sender_email:
        raise HTTPException(503, "Password reset email is not configured. Contact CropSense support.")

    with store.connection() as db:
        user = db.users.find_one({"email": payload.email, "role": "farmer", "active": True}, {"id": 1, "display_name": 1})
    if user:
        from backend.email_report import send_password_reset_otp
        otp = f"{secrets.randbelow(1_000_000):06d}"
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", otp.encode(), salt, 200_000).hex()
        created = datetime.now(timezone.utc)
        reset_id = str(uuid.uuid4())
        with store.connection() as db:
            db.farmer_password_resets.update_many({"user_id": user["id"], "consumed_at": None}, {"$set": {"consumed_at": created.isoformat()}})
            db.farmer_password_resets.insert_one({"id": reset_id, "user_id": user["id"], "otp_hash": digest,
                "otp_salt": salt.hex(), "created_at": created.isoformat(),
                "expires_at": (created + timedelta(minutes=10)).isoformat(), "consumed_at": None, "attempts": 0})
        try:
            send_password_reset_otp(recipient=payload.email, otp=otp, sender_email=sender_email,
                                    sender_name=sender_name, api_key=email_api_key)
        except Exception as exc:
            with store.connection() as db:
                db.farmer_password_resets.update_one({"id": reset_id}, {"$set": {"consumed_at": now_iso()}})
            logger.error("Farmer password reset email failed user_id=%s error_type=%s", user["id"], type(exc).__name__)
    return {"message": "If an active farmer account uses this email, a reset code will be sent shortly."}


@router.post("/auth/password-reset/complete")
def complete_farmer_password_reset(payload: PasswordResetComplete, request: Request):
    _check_origin(request)
    _rate_limit(request, "farmer-password-reset-complete", 8, 600)
    with store.connection() as db:
        user = db.users.find_one({"email": payload.email, "role": "farmer", "active": True}, {"id": 1})
        reset = db.farmer_password_resets.find_one({"user_id": user["id"], "consumed_at": None}, sort=[("created_at", -1)]) if user else None
        now = datetime.now(timezone.utc)
        valid = False
        if reset and reset["attempts"] < 5 and reset["expires_at"] > now.isoformat():
            actual = hashlib.pbkdf2_hmac("sha256", payload.otp.encode(), bytes.fromhex(reset["otp_salt"]), 200_000).hex()
            valid = secrets.compare_digest(actual, reset["otp_hash"])
            if not valid:
                attempts = reset["attempts"] + 1
                db.farmer_password_resets.update_one({"id": reset["id"]}, {"$set": {
                    "attempts": attempts, "consumed_at": now_iso() if attempts >= 5 else None}})
        if valid:
            updated = now_iso()
            db.users.update_one({"id": user["id"], "role": "farmer"}, {"$set": {"password_hash": password_hasher.hash(payload.new_password), "updated_at": updated}})
            db.farmer_password_resets.update_one({"id": reset["id"]}, {"$set": {"consumed_at": updated}})
            db.sessions.update_many({"user_id": user["id"], "revoked_at": None}, {"$set": {"revoked_at": updated}})
            _audit(db, "farmer_password_reset", user["id"], user["id"])
    if not valid:
        raise HTTPException(400, "The reset code is invalid or expired. Request a new code and try again.")
    return {"status": "password_reset"}


@router.post("/auth/login")
def login(payload: Credentials, request: Request, response: Response):
    return _login(request, response, payload)


@router.get("/auth/me")
def who_am_i(user: CurrentUser):
    return {"user": _safe_user(user), "expires_at": user["expires_at"]}


@router.post("/auth/logout")
def logout(request: Request, response: Response, user: CurrentUser):
    _check_origin(request)
    token = request.cookies.get(COOKIE_NAME, "")
    with store.connection() as db:
        db.sessions.update_one({"token_hash": token_digest(token), "revoked_at": None}, {"$set": {"revoked_at": now_iso()}})
        _audit(db, "logout", user["id"], user["id"])
    response.delete_cookie(COOKIE_NAME, path="/api", httponly=True, secure=COOKIE_SECURE, samesite="lax")
    return {"status": "signed_out"}


@router.get("/farmer/profile")
def farmer_profile(user: FarmerUser):
    return {"user": _safe_user(user)}


@router.patch("/farmer/profile")
def update_farmer_profile(payload: ProfileUpdate, request: Request, user: FarmerUser):
    _check_origin(request)
    with store.connection() as db:
        db.users.update_one({"id": user["id"], "role": "farmer"}, {"$set": {
            "display_name": payload.display_name, "mobile_number": payload.mobile_number, "updated_at": now_iso()}})
        _audit(db, "farmer_profile_updated", user["id"], user["id"])
        row = db.users.find_one({"id": user["id"]})
    return {"user": _safe_user(row)}


@router.post("/farmer/password")
def change_farmer_password(payload: PasswordChange, request: Request, user: FarmerUser):
    _check_origin(request)
    with store.connection() as db:
        row = db.users.find_one({"id": user["id"]}, {"password_hash": 1})
        try:
            valid = password_hasher.verify(row["password_hash"], payload.current_password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            valid = False
        if not valid:
            raise HTTPException(400, "Current password is incorrect.")
        updated = now_iso()
        db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": password_hasher.hash(payload.new_password), "updated_at": updated}})
        db.sessions.update_many({"user_id": user["id"], "id": {"$ne": user["session_id"]}, "revoked_at": None}, {"$set": {"revoked_at": updated}})
        _audit(db, "farmer_password_changed", user["id"], user["id"])
    return {"status": "password_changed"}


@router.get("/farmer/history")
def farmer_history(user: FarmerUser, limit: Annotated[int, Query(ge=1, le=10)] = 10,
                   offset: Annotated[int, Query(ge=0)] = 0, q: str = ""):
    search = q.strip()[:100]
    query: dict = {"user_id": user["id"]}
    if search:
        query["search_text"] = {"$regex": re.escape(search), "$options": "i"}
    with store.connection() as db:
        total = db.recommendation_history.count_documents(query)
        rows = list(db.recommendation_history.find(query, {"_id": 0}).sort([("created_at", -1), ("id", -1)]).skip(offset).limit(limit))
    return {"items": [{"id": row["id"], "report_id": f"{row['report_number']:05d}", "created_at": row["created_at"], "inputs": row["inputs"],
                       "recommendations": row["recommendations"], "model_name": row["model_name"],
                       "model_version": row["model_version"], "location_name": row["location_name"],
                       "latitude": row["latitude"], "longitude": row["longitude"], "location_source": row["location_source"],
                       "village_town": row["village_town"], "farm_district": row["farm_district"], "farm_state": row["farm_state"],
                       "land_area_acres": row["land_area_acres"]} for row in rows], "total": total,
            "limit": limit, "offset": offset}


@router.get("/farmer/schemes")
def farmer_schemes(user: FarmerUser):
    from backend.schemes import SCHEMES
    with store.connection() as db:
        tracking_rows = db.farmer_scheme_tracking.find({"user_id": user["id"]}, {"_id": 0})
        latest = db.recommendation_history.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1), ("id", -1)])
    tracking = {row["scheme_id"]: row for row in tracking_rows}
    context = None
    if latest:
        try:
            recommendations = latest["recommendations"]
        except (TypeError, KeyError):
            recommendations = []
        context = {
            "location_name": latest["location_name"], "village_town": latest["village_town"],
            "farm_district": latest["farm_district"], "farm_state": latest["farm_state"],
            "land_area_acres": latest["land_area_acres"],
            "crops": [item.get("crop", "") for item in recommendations if isinstance(item, dict) and item.get("crop")],
        }
    return {"items": [{**scheme, "saved": scheme["id"] in tracking,
                        "application_status": tracking.get(scheme["id"], {}).get("application_status"),
                        "updated_at": tracking.get(scheme["id"], {}).get("updated_at")}
                       for scheme in SCHEMES], "farmer_context": context}


@router.put("/farmer/schemes/{scheme_id}", status_code=200)
def save_farmer_scheme(scheme_id: str, request: Request, user: FarmerUser):
    from backend.schemes import SCHEMES
    if scheme_id not in {scheme["id"] for scheme in SCHEMES}:
        raise HTTPException(404, "Scheme not found.")
    _check_origin(request)
    updated = now_iso()
    with store.connection() as db:
        row = db.farmer_scheme_tracking.find_one_and_update({"user_id": user["id"], "scheme_id": scheme_id},
            {"$setOnInsert": {"application_status": "not_started"}, "$set": {"updated_at": updated}},
            upsert=True, return_document=ReturnDocument.AFTER)
    return {"scheme_id": scheme_id, "saved": True, "application_status": row["application_status"], "updated_at": updated}


@router.delete("/farmer/schemes/{scheme_id}", status_code=204)
def unsave_farmer_scheme(scheme_id: str, request: Request, user: FarmerUser):
    from backend.schemes import SCHEMES
    if scheme_id not in {scheme["id"] for scheme in SCHEMES}:
        raise HTTPException(404, "Scheme not found.")
    _check_origin(request)
    with store.connection() as db:
        db.farmer_scheme_tracking.delete_one({"user_id": user["id"], "scheme_id": scheme_id})


@router.patch("/farmer/schemes/{scheme_id}/status")
def update_farmer_scheme_status(scheme_id: str, payload: SchemeStatusUpdate, request: Request, user: FarmerUser):
    from backend.schemes import SCHEMES
    if scheme_id not in {scheme["id"] for scheme in SCHEMES}:
        raise HTTPException(404, "Scheme not found.")
    _check_origin(request)
    updated = now_iso()
    with store.connection() as db:
        result = db.farmer_scheme_tracking.update_one({"user_id": user["id"], "scheme_id": scheme_id},
            {"$set": {"application_status": payload.application_status, "updated_at": updated}})
        if not result.matched_count:
            raise HTTPException(404, "Save this scheme before tracking its application.")
    return {"scheme_id": scheme_id, "application_status": payload.application_status, "updated_at": updated}


@router.get("/farmer/weather")
def farmer_weather(village_town: Annotated[str, Query(min_length=2, max_length=100)],
                  farm_district: Annotated[str, Query(min_length=2, max_length=100)],
                  farm_state: Annotated[str, Query(min_length=2, max_length=100)],
                  user: FarmerUser,
                  latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
                  longitude: Annotated[float | None, Query(ge=-180, le=180)] = None):
    """Return climate data for the exact location submitted on the recommendation form."""
    from backend.weather import LocationAmbiguous, LocationNotFound, WeatherProviderError, get_location_weather
    try:
        return get_location_weather(village_town.strip(), farm_district.strip(), farm_state.strip(), latitude, longitude)
    except LocationAmbiguous as exc:
        raise HTTPException(409, str(exc)) from exc
    except LocationNotFound as exc:
        raise HTTPException(422, str(exc)) from exc
    except WeatherProviderError as exc:
        raise HTTPException(503, str(exc)) from exc


@router.post("/farmer/recommend")
def farmer_recommend(payload: FarmerRecommendationRequest, request: Request, user: FarmerUser):
    # Reuse the existing validated model endpoint; no second prediction implementation.
    from backend import api
    _check_origin(request)
    crop_input = CropInput.model_validate(payload.model_dump(include=set(CropInput.model_fields)))
    result = api.generate_recommendation(crop_input)
    from backend.yield_benchmarks import benchmark_yield
    recommendations = []
    for item in result.recommendations:
        yield_per_acre = benchmark_yield(item.crop)
        harvest = yield_per_acre * payload.land_area_acres if yield_per_acre is not None else None
        recommendations.append(item.model_copy(update={
            "expected_yield_quintals_per_acre": yield_per_acre,
            "expected_harvest_quintals": harvest,
            "yield_benchmark_source": "indicative benchmark; not a model prediction" if yield_per_acre is not None else None,
        }))
    result = result.model_copy(update={"recommendations": recommendations})
    with store.connection() as db:
        counter = db.farmer_report_counters.find_one_and_update({"user_id": user["id"]},
            {"$inc": {"last_report_number": 1}, "$setOnInsert": {"user_id": user["id"]}},
            upsert=True, return_document=ReturnDocument.AFTER)
        report_number = counter["last_report_number"]
        if report_number > 99999:
            raise HTTPException(409, "This farmer account has reached the five-digit recommendation report ID limit.")
        record_id = str(uuid.uuid4())
        inputs = payload.model_dump(include=set(CropInput.model_fields))
        recommendation_docs = [item.model_dump() for item in result.recommendations]
        db.recommendation_history.insert_one({"id": record_id, "user_id": user["id"], "report_number": report_number,
            "created_at": now_iso(), "inputs": inputs, "recommendations": recommendation_docs,
            "search_text": json_document({"inputs": inputs, "recommendations": recommendation_docs,
                "location_name": payload.location_name, "farm_district": payload.farm_district, "farm_state": payload.farm_state}).lower(),
            "model_name": result.model_name, "model_version": result.model_version, "location_name": payload.location_name,
            "latitude": payload.latitude, "longitude": payload.longitude, "location_source": payload.location_source,
            "land_area_acres": payload.land_area_acres, "village_town": payload.village_town.strip(),
            "farm_district": payload.farm_district.strip(), "farm_state": payload.farm_state.strip()})
        _audit(db, "recommendation_created", user["id"], user["id"], {"record_id": record_id, "location_name": payload.location_name,
               "land_area_acres": payload.land_area_acres})
    return result.model_copy(update={"report_id": f"{report_number:05d}"})


@router.get("/admin/overview")
def admin_overview(user: AdminUser):
    today_start, today_end, local_now = _local_day_bounds_utc()
    trend_start_day = local_now.date() - timedelta(days=29)
    trend_start = datetime.combine(trend_start_day, datetime.min.time(), tzinfo=ZoneInfo("Asia/Kolkata")).astimezone(timezone.utc).isoformat()
    selection_cutoff = (local_now - timedelta(days=30)).astimezone(timezone.utc).isoformat()
    with store.connection() as db:
        farmers_total = db.users.count_documents({"role": "farmer"})
        farmers_active = db.users.count_documents({"role": "farmer", "active": True})
        recommendation_count = db.recommendation_history.count_documents({})
        date_filter = {"created_at": {"$gte": today_start, "$lt": today_end}}
        today_count = db.recommendation_history.count_documents(date_filter)
        logged_in_users = len(db.audit_logs.distinct("actor_user_id", {
            "action": {"$in": ["admin_login", "farmer_login"]}, "actor_user_id": {"$ne": None}}))
        trend_counts: dict[str, int] = {}
        crop_counts: dict[str, int] = {}
        for row in db.recommendation_history.find(
                {"created_at": {"$gte": trend_start, "$lt": today_end}},
                {"created_at": 1, "recommendations": 1}):
            day = datetime.fromisoformat(row["created_at"]).astimezone(ZoneInfo("Asia/Kolkata")).date().isoformat()
            trend_counts[day] = trend_counts.get(day, 0) + 1
            for crop in row.get("recommendations", []):
                if isinstance(crop, dict) and crop.get("crop"):
                    name = str(crop["crop"])
                    crop_counts[name] = crop_counts.get(name, 0) + 1
        trend = [{"date": (trend_start_day + timedelta(days=i)).isoformat(),
                  "count": trend_counts.get((trend_start_day + timedelta(days=i)).isoformat(), 0)}
                 for i in range(30)]
        today_rows = list(db.recommendation_history.find(date_filter, {"_id": 0}).sort("created_at", -1).limit(5))
        farmer_rows = {row["id"]: row for row in db.users.find(
            {"id": {"$in": [item["user_id"] for item in today_rows]}},
            {"id": 1, "email": 1, "display_name": 1, "farmer_id": 1})}
        today_items = [{
            "id": row["id"], "report_id": f"{row['report_number']:05d}", "created_at": row["created_at"],
            "farmer_email": farmer_rows.get(row["user_id"], {}).get("email"),
            "farmer_name": farmer_rows.get(row["user_id"], {}).get("display_name"),
            "farmer_id": farmer_rows.get(row["user_id"], {}).get("farmer_id"),
            "location_name": row.get("location_name"), "recommendations": row.get("recommendations", [])
        } for row in today_rows]
        top_crops = sorted(({"crop": crop, "count": count} for crop, count in crop_counts.items()),
                           key=lambda item: (-item["count"], item["crop"]))[:5]
        plan_counts: dict[str, int] = {}
        for selection in db.plan_selections.find({"selected_at": {"$gte": selection_cutoff}}, {"plan_key": 1}):
            key = selection["plan_key"]
            plan_counts[key] = plan_counts.get(key, 0) + 1
        plan_names = {p["key"]: (p.get("display_name") or p["key"]) for p in db.plan_catalog.find(
            {"key": {"$in": list(plan_counts)}})}
        popular_plans = sorted(({"key": key, "name": plan_names.get(key, key), "count": count}
                                for key, count in plan_counts.items()),
                               key=lambda item: (-item["count"], item["name"]))[:5]
        paid_rows = list(db.plan_payment_records.find({"status": "paid"}, {"amount_inr": 1}))
        signed_ids = db.sessions.distinct("user_id", {"revoked_at": None, "expires_at": {"$gt": now_iso()}})
        signed_in = db.users.count_documents({"id": {"$in": signed_ids}, "active": True})
        return {
            "farmers_total": farmers_total, "farmers_active": farmers_active,
            "recommendations_total": recommendation_count, "recommendations_today": today_count,
            "recommendation_trend": trend, "today_recommendations": today_items, "top_crops_30_days": top_crops,
            "popular_plans_30_days": popular_plans,
            "revenue_inr": sum(int(row.get("amount_inr", 0)) for row in paid_rows),
            "payments_recorded": len(paid_rows), "users_logged_in": logged_in_users,
            "recommendation_form_submissions": recommendation_count, "users_currently_signed_in": signed_in,
        }


@router.get("/admin/farmers")
def admin_farmers(user: AdminUser, q: str = "", status: str = "all", limit: int = 100, offset: int = 0):
    if status not in {"all", "active", "suspended"}:
        raise HTTPException(422, "Status must be all, active, or suspended.")
    limit, offset = min(max(limit, 1), 200), max(offset, 0)
    query: dict = {"role": "farmer"}
    if q.strip():
        pattern = {"$regex": re.escape(q.strip()[:100]), "$options": "i"}
        query["$or"] = [{"email": pattern}, {"display_name": pattern}]
    if status != "all":
        query["active"] = status == "active"
    with store.connection() as db:
        rows = db.users.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit)
    return {"items": [_safe_user(row) for row in rows]}


@router.patch("/admin/farmers/{farmer_id}/status")
def admin_set_farmer_status(farmer_id: str, payload: FarmerStatusUpdate, request: Request, user: AdminUser):
    _check_origin(request)
    with store.connection() as db:
        farmer = db.users.find_one({"id": farmer_id, "role": "farmer"})
        if not farmer:
            raise HTTPException(404, "Farmer account not found.")
        if bool(farmer["active"]) != payload.active:
            changed = now_iso()
            db.users.update_one({"id": farmer_id, "role": "farmer"},
                                {"$set": {"active": payload.active, "updated_at": changed}})
            if not payload.active:
                db.sessions.update_many({"user_id": farmer_id, "revoked_at": None},
                                         {"$set": {"revoked_at": changed}})
            _audit(db, "farmer_activated" if payload.active else "farmer_suspended",
                   user["id"], farmer_id, {"email": farmer["email"]})
        row = db.users.find_one({"id": farmer_id})
    return {"user": _safe_user(row)}


@router.get("/admin/activity")
def admin_activity(user: AdminUser, limit: int = 100, offset: int = 0):
    limit, offset = min(max(limit, 1), 200), max(offset, 0)
    with store.connection() as db:
        total = db.recommendation_history.count_documents({})
        rows = list(db.recommendation_history.find({}, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit))
        users = {row["id"]: row for row in db.users.find(
            {"id": {"$in": [item["user_id"] for item in rows]}},
            {"id": 1, "email": 1, "display_name": 1, "farmer_id": 1})}
    items = [{"id": row["id"], "created_at": row["created_at"],
              "farmer_id": users.get(row["user_id"], {}).get("farmer_id"),
              "farmer_email": users.get(row["user_id"], {}).get("email"),
              "farmer_name": users.get(row["user_id"], {}).get("display_name"),
              "recommendations": row.get("recommendations", []), "location_name": row.get("location_name"),
              "model_name": row.get("model_name"), "model_version": row.get("model_version")}
             for row in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/admin/audit")
def admin_audit(user: AdminUser, limit: int = 100, offset: int = 0):
    limit, offset = min(max(limit, 1), 200), max(offset, 0)
    with store.connection() as db:
        total = db.audit_logs.count_documents({})
        rows = list(db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit))
        ids = {value for row in rows for value in (row.get("actor_user_id"), row.get("target_user_id")) if value}
        users = {row["id"]: row for row in db.users.find({"id": {"$in": list(ids)}}, {"id": 1, "email": 1})}
    items = [{"id": row["id"], "action": row["action"], "detail": row.get("detail", {}),
              "created_at": row["created_at"],
              "actor_email": users.get(row.get("actor_user_id"), {}).get("email"),
              "target_email": users.get(row.get("target_user_id"), {}).get("email")} for row in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/admin/system")
def admin_system(user: AdminUser):
    root = Path(__file__).resolve().parents[1]
    try:
        manifest = yaml.safe_load((root / "datasets/manifest.yaml").read_text(encoding="utf-8")) or {}
        sources = [{"path": source.get("path", ""), "enabled": bool(source.get("enabled", True)),
                    "available": (root / source.get("path", "")).is_file()} for source in manifest.get("sources", [])]
    except (OSError, yaml.YAMLError, AttributeError):
        sources = []
    try:
        metadata_path = root / "models/metadata.json"
        artifact_path = root / "models/crop_model.joblib"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        artifact_hash = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
        if artifact_hash != metadata.get("artifact_sha256"):
            raise ValueError("Trained artifact hash does not match metadata.")
        model_state = {"status": "ready", "model_name": metadata.get("model_name"), "model_version": metadata.get("model_version"),
                       "trained_rows": metadata.get("final_fit_rows"), "trained_classes": len(metadata.get("classes", [])),
                       "evaluation": metadata.get("evaluation", {}), "dataset_fingerprint": metadata.get("dataset_fingerprint")}
    except (OSError, json.JSONDecodeError, ValueError):
        model_state = {"status": "missing"}
    return {"sources": sources, "model": model_state, "automatic_training": False}
