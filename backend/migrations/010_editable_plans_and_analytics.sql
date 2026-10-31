ALTER TABLE plan_catalog ADD COLUMN display_name TEXT;
ALTER TABLE plan_catalog ADD COLUMN description TEXT;
ALTER TABLE plan_catalog ADD COLUMN features_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE plan_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_key TEXT NOT NULL REFERENCES plan_catalog(plan_key),
    selected_at TEXT NOT NULL
);
CREATE INDEX idx_plan_selections_date ON plan_selections(selected_at, plan_key);

CREATE TABLE plan_payment_records (
    id TEXT PRIMARY KEY,
    plan_key TEXT NOT NULL REFERENCES plan_catalog(plan_key),
    amount_inr INTEGER NOT NULL CHECK (amount_inr >= 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    paid_at TEXT,
    provider_reference TEXT
);
CREATE INDEX idx_plan_payments_status ON plan_payment_records(status, paid_at);
