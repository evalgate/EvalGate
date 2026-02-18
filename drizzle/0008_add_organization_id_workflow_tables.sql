-- Add organization_id to workflow/orchestration tables (before 0009 backfill)
-- Run only if 0009 fails on workflow_runs, agent_handoffs, etc.

ALTER TABLE workflow_runs ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE agent_handoffs ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE agent_decisions ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE cost_records ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE audit_logs ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
