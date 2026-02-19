-- Standardize evaluations.created_at and updated_at from text to integer (Unix seconds)
-- Matches organizations pattern for schema consistency.
-- SQLite: recreate table since ALTER COLUMN type is not supported.

PRAGMA foreign_keys=OFF;

CREATE TABLE evaluations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  created_by TEXT NOT NULL REFERENCES user(id),
  execution_settings TEXT,
  model_settings TEXT,
  custom_metrics TEXT,
  executor_type TEXT,
  executor_config TEXT,
  published_run_id INTEGER,
  published_version INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Convert ISO text to Unix seconds (unixepoch parses ISO8601 in SQLite 3.38+)
INSERT INTO evaluations_new (
  id, name, description, type, status, organization_id, created_by,
  execution_settings, model_settings, custom_metrics, executor_type, executor_config,
  published_run_id, published_version, created_at, updated_at
)
SELECT
  id, name, description, type, status, organization_id, created_by,
  execution_settings, model_settings, custom_metrics, executor_type, executor_config,
  published_run_id, published_version,
  unixepoch(created_at),
  unixepoch(updated_at)
FROM evaluations;

DROP TABLE evaluations;

ALTER TABLE evaluations_new RENAME TO evaluations;

PRAGMA foreign_keys=ON;
