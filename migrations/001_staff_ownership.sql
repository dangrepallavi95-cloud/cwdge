-- Applied defensively by public/index.php on every startup for existing SQLite databases.
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SQLite does not support ADD COLUMN IF NOT EXISTS. The app checks PRAGMA table_info
-- before running this statement so it is safe for both new and existing installations.
ALTER TABLE cards ADD COLUMN staff_id INTEGER REFERENCES staff(id);
