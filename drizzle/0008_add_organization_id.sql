-- Add organization_id (nullable) to tables before 0009 backfill
-- 0009 backfills these from parent joins, then columns can be made NOT NULL

ALTER TABLE evaluation_runs ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE test_results ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
