ALTER TABLE users ADD COLUMN mobile_number TEXT NOT NULL DEFAULT '';
ALTER TABLE recommendation_history ADD COLUMN location_name TEXT NOT NULL DEFAULT '';
ALTER TABLE recommendation_history ADD COLUMN latitude REAL;
ALTER TABLE recommendation_history ADD COLUMN longitude REAL;
ALTER TABLE recommendation_history ADD COLUMN location_source TEXT NOT NULL DEFAULT 'manual';
CREATE INDEX idx_recommendations_location ON recommendation_history(location_name);
