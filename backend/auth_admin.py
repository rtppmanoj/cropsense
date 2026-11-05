"""Explicit, environment-driven administrative account provisioning."""
from __future__ import annotations

import os
import re
import uuid

from argon2 import PasswordHasher

from backend.auth import now_iso, _audit
from backend.auth_store import AuthStore, DB_INTEGRITY_ERRORS


def ensure_admin_from_environment() -> bool:
    """Create the first admin when configured; safe to call on every startup."""
    email = os.getenv("CROPSENSE_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("CROPSENSE_ADMIN_PASSWORD", "")
    if not email and not password:
        return False

    store = AuthStore()
    created = now_iso()
    user_id = str(uuid.uuid4())
    try:
        with store.connection() as db:
            if db.users.find_one({"role": "admin"}, {"_id": 1}):
                return False
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
                raise RuntimeError("CROPSENSE_ADMIN_EMAIL must be a valid address to create the initial admin.")
            if len(password) < 8 or len(password) > 128:
                raise RuntimeError("CROPSENSE_ADMIN_PASSWORD must be 8-128 characters to create the initial admin.")
            db.users.insert_one({"id": user_id, "email": email, "display_name": "CropSense administrator",
                "password_hash": PasswordHasher().hash(password), "role": "admin", "active": True,
                "created_at": created, "updated_at": created, "mobile_number": None, "farmer_id": None})
            _audit(db, "admin_provisioned", user_id, user_id)
    except DB_INTEGRITY_ERRORS as exc:
        raise RuntimeError("The configured admin email already belongs to another account.") from exc
    return True


def provision_admin() -> None:
    email = os.getenv("CROPSENSE_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("CROPSENSE_ADMIN_PASSWORD", "")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise SystemExit("Set CROPSENSE_ADMIN_EMAIL to a valid address before provisioning.")
    if len(password) < 8 or len(password) > 128:
        raise SystemExit("Set CROPSENSE_ADMIN_PASSWORD to a password between 8 and 128 characters.")
    store = AuthStore()
    created = now_iso()
    user_id = str(uuid.uuid4())
    try:
        with store.connection() as db:
            if db.users.find_one({"role": "admin"}, {"_id": 1}):
                raise SystemExit("An admin account already exists. Provisioning will not replace or reset it.")
            db.users.insert_one({"id": user_id, "email": email, "display_name": "CropSense administrator",
                "password_hash": PasswordHasher().hash(password), "role": "admin", "active": True,
                "created_at": created, "updated_at": created, "mobile_number": None, "farmer_id": None})
            _audit(db, "admin_provisioned", user_id, user_id)
    except DB_INTEGRITY_ERRORS as exc:
        raise SystemExit("That email already belongs to an account; no admin was created.") from exc
    print(f"Initial admin provisioned for {email}. The password was not printed or stored in plaintext.")


if __name__ == "__main__":
    provision_admin()
