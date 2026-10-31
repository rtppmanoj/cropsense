CREATE TABLE plan_catalog (
    plan_key TEXT PRIMARY KEY CHECK (plan_key IN (
        'free', 'basic', 'plus', 'premium', 'organizationStarter', 'organizationGrowth'
    )),
    price_inr INTEGER NOT NULL CHECK (price_inr BETWEEN 0 AND 10000000),
    annual_limit INTEGER NOT NULL CHECK (annual_limit BETWEEN 1 AND 1000000),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO plan_catalog(plan_key, price_inr, annual_limit) VALUES
    ('free', 0, 3),
    ('basic', 49, 5),
    ('plus', 149, 15),
    ('premium', 399, 50),
    ('organizationStarter', 999, 500),
    ('organizationGrowth', 2499, 2000);
