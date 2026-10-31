ALTER TABLE recommendation_history ADD COLUMN report_number INTEGER;

UPDATE recommendation_history
SET report_number = (
    SELECT COUNT(*)
    FROM recommendation_history AS earlier
    WHERE earlier.user_id = recommendation_history.user_id
      AND (earlier.created_at < recommendation_history.created_at
           OR (earlier.created_at = recommendation_history.created_at
               AND earlier.id <= recommendation_history.id))
);

CREATE UNIQUE INDEX idx_recommendation_report_number
    ON recommendation_history(user_id, report_number);
