-- Per-test-case provenance coverage rate (0..1) for quality scores
ALTER TABLE quality_scores ADD COLUMN provenance_coverage_rate TEXT;
