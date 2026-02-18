-- Create quality_scores table (required before 0013, 0015, 0017, 0019)
CREATE TABLE IF NOT EXISTS quality_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  evaluation_run_id INTEGER NOT NULL REFERENCES evaluation_runs(id),
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  score INTEGER NOT NULL,
  breakdown TEXT NOT NULL,
  flags TEXT NOT NULL,
  created_at TEXT NOT NULL
);
