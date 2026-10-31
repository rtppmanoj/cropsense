ALTER TABLE users ADD COLUMN farmer_id TEXT;

UPDATE users
SET farmer_id = 'CSF-' || upper(substr(replace(id, '-', ''), 1, 12))
WHERE role = 'farmer';

CREATE UNIQUE INDEX idx_users_farmer_id ON users(farmer_id) WHERE farmer_id IS NOT NULL;
