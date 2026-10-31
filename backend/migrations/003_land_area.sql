ALTER TABLE recommendation_history ADD COLUMN land_area_acres REAL NOT NULL DEFAULT 1 CHECK (land_area_acres > 0);
