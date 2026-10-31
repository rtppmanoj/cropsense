CREATE TABLE farmer_report_counters (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_report_number INTEGER NOT NULL CHECK (last_report_number BETWEEN 0 AND 99999)
);

INSERT INTO farmer_report_counters(user_id, last_report_number)
SELECT user_id, MAX(report_number)
FROM recommendation_history
WHERE report_number IS NOT NULL
GROUP BY user_id;
