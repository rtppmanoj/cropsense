"""MongoDB persistence for CropSense accounts and farmer data."""
from __future__ import annotations

import hashlib
import json
import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

DB_ERRORS = (PyMongoError,)
DB_INTEGRITY_ERRORS = (DuplicateKeyError,)
ROOT = Path(__file__).resolve().parents[1]

DEFAULT_PLANS = [
    {"key": "free", "price_inr": 0, "annual_limit": 3, "is_recommended": False,
     "features": ["cropRecommendations", "weatherOutlook", "governmentSchemes", "onlineResults", "chatbotFeature"]},
    {"key": "basic", "price_inr": 49, "annual_limit": 5, "is_recommended": False,
     "features": ["cropRecommendations", "weatherOutlook", "governmentSchemes", "onlineResults", "fertilizerRecommendations", "pdfDownload", "emailReports", "eligibilityGuidance", "savedHistory", "chatbotFeature"]},
    {"key": "plus", "price_inr": 149, "annual_limit": 15, "is_recommended": True,
     "features": ["cropRecommendations", "weatherOutlook", "governmentSchemes", "onlineResults", "fertilizerRecommendations", "pdfDownload", "emailReports", "eligibilityGuidance", "savedHistory", "marketPriceInsights", "disasterAssistance", "chatbotFeature"]},
    {"key": "premium", "price_inr": 399, "annual_limit": 50, "is_recommended": False,
     "features": ["cropRecommendations", "weatherOutlook", "governmentSchemes", "onlineResults", "fertilizerRecommendations", "pdfDownload", "emailReports", "eligibilityGuidance", "savedHistory", "marketPriceInsights", "disasterAssistance", "higherQuota", "chatbotFeature"]},
    {"key": "organizationStarter", "price_inr": 999, "annual_limit": 500, "is_recommended": False,
     "features": ["cropRecommendations", "weatherContext", "onlineResultsReports"]},
    {"key": "organizationGrowth", "price_inr": 2499, "annual_limit": 2000, "is_recommended": False,
     "features": ["cropRecommendations", "weatherContext", "onlineResultsReports"]},
]


class AuthStore:
    """Owns one MongoClient per worker; MongoClient itself is thread-safe."""

    def __init__(self):
        self._client: MongoClient | None = None
        self._database = None
        self._initialized_name: str | None = None

    @property
    def uses_mongodb(self) -> bool:
        return True

    def _get_database(self):
        uri = os.getenv("MONGODB_URI", "").strip()
        if not uri:
            raise RuntimeError("MONGODB_URI must be configured. SQLite storage has been removed.")
        database_name = os.getenv("MONGODB_DATABASE", "cropsense").strip() or "cropsense"
        if self._client is None or self._database.name != database_name:
            if self._client is not None:
                self._client.close()
            self._client = MongoClient(uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000,
                                       appname="CropSense", retryWrites=True)
            self._database = self._client[database_name]
            self._initialized_name = None
        if self._initialized_name != database_name:
            self._client.admin.command("ping")
            self._initialize(self._database)
            self._initialized_name = database_name
        return self._database

    def check(self) -> None:
        if self._client is None:
            self._get_database()
        else:
            self._client.admin.command("ping")

    @contextmanager
    def connection(self) -> Iterator[object]:
        yield self._get_database()

    @staticmethod
    def _initialize(db) -> None:
        db.users.create_index([("email", ASCENDING)], unique=True, name="users_email_unique")
        db.users.create_index([("farmer_id", ASCENDING)], unique=True, sparse=True, name="users_farmer_id_unique")
        db.sessions.create_index([("token_hash", ASCENDING)], unique=True, name="sessions_token_unique")
        db.sessions.create_index([("user_id", ASCENDING), ("expires_at", ASCENDING)], name="sessions_user_expiry")
        db.recommendation_history.create_index([("user_id", ASCENDING), ("created_at", DESCENDING), ("id", DESCENDING)], name="history_user_created")
        db.recommendation_history.create_index([("user_id", ASCENDING), ("report_number", ASCENDING)], unique=True, name="history_report_unique")
        db.recommendation_history.create_index([("created_at", ASCENDING)], name="history_created")
        db.audit_logs.create_index([("created_at", DESCENDING)], name="audit_created")
        db.audit_logs.create_index([("action", ASCENDING), ("actor_user_id", ASCENDING)], name="audit_action_actor")
        db.farmer_scheme_tracking.create_index([("user_id", ASCENDING), ("scheme_id", ASCENDING)], unique=True, name="scheme_user_unique")
        db.farmer_report_counters.create_index([("user_id", ASCENDING)], unique=True, name="report_counter_user_unique")
        db.plan_catalog.create_index([("key", ASCENDING)], unique=True, name="plan_key_unique")
        db.plan_selections.create_index([("selected_at", ASCENDING), ("plan_key", ASCENDING)], name="plan_selection_date")
        db.plan_payment_records.create_index([("status", ASCENDING), ("paid_at", ASCENDING)], name="payment_status_date")
        db.farmer_password_resets.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="password_reset_user_created")
        for plan in DEFAULT_PLANS:
            db.plan_catalog.update_one({"key": plan["key"]}, {"$setOnInsert": {
                **plan, "active": True, "display_name": None, "description": None, "updated_at": ""}}, upsert=True)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
            self._database = None
            self._initialized_name = None


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def json_document(value) -> str:
    """Stable compact JSON used only to build searchable history text."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
