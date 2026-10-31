"""FastAPI service. Train once with `python -m backend.train` before startup."""
from __future__ import annotations

import json
import hashlib
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from backend.dataset_pipeline import FEATURES
from backend.schemas import CropInput, CropMatch, RecommendationResponse
from backend.auth import router as auth_router, store as auth_store
from backend.auth_admin import ensure_admin_from_environment
from backend.email_report import router as email_report_router
from backend.chatbot import router as chatbot_router
from backend.plans import router as plans_router

MODEL_DIR = ROOT / "models"
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app):
    with auth_store.connection() as db:
        db.execute("DELETE FROM sessions WHERE julianday(expires_at) < julianday('now')")
    try:
        if ensure_admin_from_environment():
            logger.info("Initial admin account provisioned from deployment environment.")
    except RuntimeError as exc:
        logger.error("Initial admin provisioning failed: %s", exc)
        raise
    try:
        load_artifacts()
    except HTTPException as exc:
        logger.warning("Model warm-up failed; recommendation requests will remain unavailable: %s", exc.detail)
    yield


app = FastAPI(title="CropSense recommendation API", version="1.0.0", lifespan=lifespan)
cors_origins = list(dict.fromkeys([
    *(origin.strip() for origin in os.getenv(
        "CROPSENSE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()),
    "https://worshiper-valuables-slacks.ngrok-free.dev",
]))
cors_settings = {"allow_origins": cors_origins, "allow_credentials": True,
                 "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type"]}
if os.getenv("CROPSENSE_ENV", "development").lower() != "production":
    cors_settings["allow_origin_regex"] = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"
app.add_middleware(CORSMiddleware, **cors_settings)
app.include_router(auth_router)
app.include_router(email_report_router)
app.include_router(chatbot_router)
app.include_router(plans_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    if os.getenv("CROPSENSE_ENV", "development").lower() == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


model = None
metadata = None
loaded_stamp = None


def load_artifacts():
    global model, metadata, loaded_stamp
    model_path, metadata_path = MODEL_DIR / "crop_model.joblib", MODEL_DIR / "metadata.json"
    if not model_path.is_file() or not metadata_path.is_file():
        raise HTTPException(status_code=503, detail="Model artifacts are missing. Run `python -m backend.train` first.")
    try:
        stamp = (model_path.stat().st_mtime_ns, metadata_path.stat().st_mtime_ns)
        if model is None or metadata is None or stamp != loaded_stamp:
            next_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            artifact_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
            if artifact_hash != next_metadata.get("artifact_sha256"):
                raise HTTPException(status_code=503, detail="Model artifacts are being updated. Retry shortly.")
            next_model = joblib.load(model_path)
            classifier = next_model.named_steps["classifier"]
            if (list(FEATURES) != next_metadata.get("features") or not hasattr(next_model, "predict_proba")
                    or [str(label) for label in classifier.classes_] != next_metadata.get("classes")):
                raise HTTPException(status_code=503, detail="Model artifact and metadata do not match. Retrain the model.")
            if stamp != (model_path.stat().st_mtime_ns, metadata_path.stat().st_mtime_ns):
                raise HTTPException(status_code=503, detail="Model artifacts changed during reload. Retry shortly.")
            model, metadata, loaded_stamp = next_model, next_metadata, stamp
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Model artifacts could not be loaded. Retrain the model.") from exc
    return model, metadata


@app.get("/api/health")
def health():
    try:
        _, info = load_artifacts()
        return {"status": "ready", "model": info["model_name"], "version": info["model_version"]}
    except HTTPException:
        return JSONResponse(status_code=503, content={"status": "model_unavailable"})


@app.get("/api/metadata")
def get_metadata():
    _, info = load_artifacts()
    return {"model_name": info["model_name"], "model_version": info["model_version"],
            "features": info["features"], "feature_units": info["feature_units"],
            "evaluation": {key: info["evaluation"][key] for key in
                           ("holdout_rows", "holdout_accuracy", "holdout_balanced_accuracy", "holdout_macro_f1",
                            "holdout_top5_accuracy")}}


def generate_recommendation(payload: CropInput) -> RecommendationResponse:
    estimator, info = load_artifacts()
    values = payload.model_dump()
    X = pd.DataFrame([{feature: values[feature] for feature in FEATURES}], columns=FEATURES)
    try:
        probabilities = np.asarray(estimator.predict_proba(X)[0], dtype=float)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The trained model could not score these inputs.") from exc
    classes = estimator.named_steps["classifier"].classes_
    if (probabilities.shape != (len(classes),) or not np.isfinite(probabilities).all()
            or (probabilities < 0).any() or probabilities.sum() <= 0):
        raise HTTPException(status_code=503, detail="The trained model returned invalid scores.")
    probabilities = probabilities / probabilities.sum()
    ordered = np.argsort(probabilities)[::-1][:min(5, len(classes))]
    warnings: list[str] = []
    outside = [feature for feature in FEATURES if values[feature] < info["training_ranges"][feature][0]
               or values[feature] > info["training_ranges"][feature][1]]
    if outside:
        warnings.append("One or more submitted values are outside the observed training range; interpret recommendations cautiously.")
    top_probability = float(probabilities[ordered[0]])
    chance_baseline = 1 / len(classes)
    if top_probability <= chance_baseline:
        warnings.append("The top class score is no greater than a uniform chance baseline across crop classes; treat the ranking as ambiguous.")
    centers, scales = info["class_centers"], info["feature_scales"]
    matches = []
    for index in ordered:
        crop = str(classes[index])
        deltas = sorted(((abs(values[feature] - centers[crop][feature]) / max(scales[feature], 1e-9), feature)
                         for feature in FEATURES), key=lambda item: item[0])
        nearest = [feature.replace("_", " ") for _, feature in deltas[:3]]
        matches.append(CropMatch(crop=crop, score=round(float(probabilities[index]), 4),
                                 explanation="Among the strongest similarities to this crop's training examples: " + ", ".join(nearest) + "."))
    return RecommendationResponse(recommendations=matches, within_observed_feature_ranges=not outside,
                                  score_interpretation="Normalized classifier output; not a calibrated probability of crop success.",
                                  warnings=warnings, model_name=info["model_name"], model_version=info["model_version"],
                                  evaluated_accuracy=info["evaluation"]["holdout_accuracy"],
                                  evaluated_macro_f1=info["evaluation"]["holdout_macro_f1"])
