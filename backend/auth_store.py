"""SQLite locally and managed PostgreSQL persistence for CropSense data."""
from __future__ import annotations

import hashlib
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

try:
    import psycopg
    from psycopg.rows import tuple_row
except ImportError:  # SQLite-only local setups need not install the PostgreSQL driver.
    psycopg = None
    tuple_row = None

if psycopg is not None:
    DB_ERRORS = (sqlite3.Error, psycopg.Error)
    DB_INTEGRITY_ERRORS = (sqlite3.IntegrityError, psycopg.IntegrityError)
else:
    DB_ERRORS = (sqlite3.Error,)
    DB_INTEGRITY_ERRORS = (sqlite3.IntegrityError,)


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

    @property
    def uses_postgres(self) -> bool:
        return bool(os.getenv("DATABASE_URL", "").strip())

    @contextmanager
    def connection(self) -> Iterator[object]:
        database_url = os.getenv("DATABASE_URL", "").strip()
        if database_url:
            if psycopg is None:
                raise RuntimeError("DATABASE_URL is set, but psycopg is not installed. Install the backend requirements.")
            if database_url.startswith("postgres://"):
                database_url = "postgresql://" + database_url.removeprefix("postgres://")
            connection = PostgresConnection(psycopg.connect(
                database_url, row_factory=tuple_row, prepare_threshold=None, connect_timeout=10
            ))
            try:
                self._initialize_postgres(connection)
                connection.commit()
                yield connection
                connection.commit()
            except Exception:
                connection.rollback()
                raise
            finally:
                connection.close()
            return

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

    @staticmethod
    def _initialize_postgres(connection: "PostgresConnection") -> None:
        connection.execute("SELECT pg_advisory_xact_lock(1464087877, 1)")
        connection.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
        applied = {row[0] for row in connection.execute("SELECT version FROM schema_migrations").fetchall()}
        version = 1
        if version in applied:
            return
        migration = ROOT / "backend/migrations_postgres/001_initial_schema.sql"
        for statement in migration.read_text(encoding="utf-8").split(";"):
            if statement.strip():
                connection.execute(statement)
        connection.execute("INSERT INTO schema_migrations(version, applied_at) VALUES(?, CURRENT_TIMESTAMP::text)", (version,))


class DbRow(dict):
    """Mapping row that also preserves sqlite-style integer indexing."""

    def __init__(self, columns: list[str], values: tuple):
        super().__init__(zip(columns, values))
        self._values = values

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


class PostgresCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    def _row(self, values):
        if values is None:
            return None
        return DbRow([column.name for column in self._cursor.description], values)

    def fetchone(self):
        return self._row(self._cursor.fetchone())

    def fetchall(self):
        return [self._row(values) for values in self._cursor.fetchall()]

    @property
    def rowcount(self):
        return self._cursor.rowcount


class PostgresConnection:
    """Small adapter for existing sqlite-style execute/fetch call sites."""

    def __init__(self, connection):
        self._connection = connection

    @staticmethod
    def _sql(query: str) -> str:
        return query.replace("?", "%s")

    @staticmethod
    def _parameters(parameters):
        return tuple(int(value) if isinstance(value, bool) else value for value in parameters)

    def execute(self, query: str, parameters=()):
        return PostgresCursor(self._connection.execute(self._sql(query), self._parameters(parameters)))

    def executemany(self, query: str, parameter_sets):
        cursor = self._connection.cursor()
        cursor.executemany(self._sql(query), (self._parameters(parameters) for parameters in parameter_sets))
        return PostgresCursor(cursor)

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
