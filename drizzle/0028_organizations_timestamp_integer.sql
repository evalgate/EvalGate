-- Standardize organizations.created_at and updated_at from text to integer (Unix seconds)
-- Matches auth tables (user, session, account, verification) for schema consistency.
-- SQLite: recreate table since ALTER COLUMN type is not supported.

PRAGMA foreign_keys=OFF;

-- Retry-safe: drop if left from failed run
DROP TABLE IF EXISTS organizations_new;

CREATE TABLE organizations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Convert ISO text to Unix seconds. COALESCE handles NULL/unparseable (unixepoch returns NULL for some formats).
INSERT INTO organizations_new (id, name, created_at, updated_at)
SELECT
  id,
  name,
  COALESCE(unixepoch(created_at), strftime('%s', replace(created_at, 'T', ' ')), strftime('%s', 'now')),
  COALESCE(unixepoch(updated_at), strftime('%s', replace(updated_at, 'T', ' ')), strftime('%s', 'now'))
FROM organizations;

DROP TABLE organizations;

ALTER TABLE organizations_new RENAME TO organizations;

PRAGMA foreign_keys=ON;
