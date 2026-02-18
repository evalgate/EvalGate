-- Per-test-case provenance: whether this result has model/provider from cost records
-- For trace-linked: set when matched span has cost. For direct_llm: set when run has cost.
ALTER TABLE test_results ADD COLUMN has_provenance INTEGER;
