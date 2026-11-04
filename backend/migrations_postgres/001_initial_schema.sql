CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    farmer_id TEXT,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    mobile_number TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'farmer')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_farmer_id ON users(farmer_id) WHERE farmer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS recommendation_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_number INTEGER,
    created_at TEXT NOT NULL,
    input_json TEXT NOT NULL,
    recommendations_json TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    location_name TEXT NOT NULL DEFAULT '',
    latitude REAL,
    longitude REAL,
    location_source TEXT NOT NULL DEFAULT 'manual',
    land_area_acres REAL NOT NULL DEFAULT 1 CHECK (land_area_acres > 0),
    village_town TEXT NOT NULL DEFAULT '',
    farm_district TEXT NOT NULL DEFAULT '',
    farm_state TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_created ON recommendation_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_location ON recommendation_history(location_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendation_report_number ON recommendation_history(user_id, report_number);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS farmer_scheme_tracking (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id TEXT NOT NULL,
    application_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (application_status IN ('not_started', 'preparing', 'applied', 'follow_up', 'completed')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, scheme_id)
);
CREATE INDEX IF NOT EXISTS idx_farmer_scheme_tracking_user ON farmer_scheme_tracking(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS farmer_report_counters (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_report_number INTEGER NOT NULL CHECK (last_report_number BETWEEN 0 AND 99999)
);

CREATE TABLE IF NOT EXISTS plan_catalog (
    plan_key TEXT PRIMARY KEY CHECK (plan_key IN (
        'free', 'basic', 'plus', 'premium', 'organizationStarter', 'organizationGrowth'
    )),
    price_inr INTEGER NOT NULL CHECK (price_inr BETWEEN 0 AND 10000000),
    annual_limit INTEGER NOT NULL CHECK (annual_limit BETWEEN 1 AND 1000000),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
    display_name TEXT,
    description TEXT,
    features_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    is_recommended INTEGER NOT NULL DEFAULT 0 CHECK (is_recommended IN (0, 1))
);
INSERT INTO plan_catalog(plan_key, price_inr, annual_limit, is_recommended, features_json) VALUES
    ('free', 0, 3, 0, '["cropRecommendations","weatherOutlook","governmentSchemes","onlineResults","chatbotFeature"]'),
    ('basic', 49, 5, 0, '["cropRecommendations","weatherOutlook","governmentSchemes","onlineResults","fertilizerRecommendations","pdfDownload","emailReports","eligibilityGuidance","savedHistory","chatbotFeature"]'),
    ('plus', 149, 15, 1, '["cropRecommendations","weatherOutlook","governmentSchemes","onlineResults","fertilizerRecommendations","pdfDownload","emailReports","eligibilityGuidance","savedHistory","marketPriceInsights","disasterAssistance","chatbotFeature"]'),
    ('premium', 399, 50, 0, '["cropRecommendations","weatherOutlook","governmentSchemes","onlineResults","fertilizerRecommendations","pdfDownload","emailReports","eligibilityGuidance","savedHistory","marketPriceInsights","disasterAssistance","higherQuota","chatbotFeature"]'),
    ('organizationStarter', 999, 500, 0, '["cropRecommendations","weatherContext","onlineResultsReports"]'),
    ('organizationGrowth', 2499, 2000, 0, '["cropRecommendations","weatherContext","onlineResultsReports"]')
ON CONFLICT(plan_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS plan_selections (
    id BIGSERIAL PRIMARY KEY,
    plan_key TEXT NOT NULL REFERENCES plan_catalog(plan_key),
    selected_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_selections_date ON plan_selections(selected_at, plan_key);

CREATE TABLE IF NOT EXISTS plan_payment_records (
    id TEXT PRIMARY KEY,
    plan_key TEXT NOT NULL REFERENCES plan_catalog(plan_key),
    amount_inr INTEGER NOT NULL CHECK (amount_inr >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    paid_at TEXT,
    provider_reference TEXT
);
CREATE INDEX IF NOT EXISTS idx_plan_payments_status ON plan_payment_records(status, paid_at);

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
CREATE INDEX IF NOT EXISTS idx_farmer_password_resets_user_created ON farmer_password_resets(user_id, created_at DESC);
