-- Reproducible scoring: inputs + scoring spec + hashes for audit verification
ALTER TABLE quality_scores ADD COLUMN inputs_json TEXT;
ALTER TABLE quality_scores ADD COLUMN scoring_spec_json TEXT;
ALTER TABLE quality_scores ADD COLUMN inputs_hash TEXT;
ALTER TABLE quality_scores ADD COLUMN scoring_spec_hash TEXT;
ALTER TABLE quality_scores ADD COLUMN scoring_commit TEXT;
