CREATE TABLE farmer_scheme_tracking (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id TEXT NOT NULL,
    application_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (application_status IN ('not_started', 'preparing', 'applied', 'follow_up', 'completed')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, scheme_id)
);
CREATE INDEX idx_farmer_scheme_tracking_user ON farmer_scheme_tracking(user_id, updated_at DESC);
