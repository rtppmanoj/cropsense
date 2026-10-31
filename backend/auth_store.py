"""SQLite persistence for CropSense identities, sessions, history, and audit events."""
from __future__ import annotations

import hashlib
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


ROOT = Path(__file__).resolve().parents[1]


def configured_db_path() -> Path:
    configured = os.getenv("CROPSENSE_DB_PATH", "data/cropsense.sqlite3")
    path = Path(configured)
    return path if path.is_absolute() else (ROOT / path).resolve()


class AuthStore:
    def __init__(self, path: Path | None = None):
        self.path = path

    @property
    def db_path(self) -> Path:
        return self.path or configured_db_path()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        path = self.db_path
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=10, isolation_level="IMMEDIATE")
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        if os.name != "nt":
            os.chmod(path, 0o600)
        try:
            self.initialize(connection)
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def initialize(connection: sqlite3.Connection) -> None:
        connection.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
        applied = {row[0] for row in connection.execute("SELECT version FROM schema_migrations")}
        for migration in sorted((ROOT / "backend/migrations").glob("[0-9][0-9][0-9]_*.sql")):
            version = int(migration.stem.split("_", 1)[0])
            if version in applied:
                continue
            script = migration.read_text(encoding="utf-8")
            connection.executescript(f"BEGIN IMMEDIATE;\n{script}\nINSERT INTO schema_migrations(version, applied_at) VALUES({version}, datetime('now'));\nCOMMIT;")


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
