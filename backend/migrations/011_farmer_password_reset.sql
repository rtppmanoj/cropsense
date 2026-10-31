CREATE TABLE IF NOT EXISTS farmer_password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash TEXT NOT NULL,
    otp_salt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_farmer_password_resets_user_created
    ON farmer_password_resets(user_id, created_at DESC);
