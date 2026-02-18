-- Index for TraceLinkedExecutor when filtering by evaluation_run_id + input_hash
CREATE INDEX IF NOT EXISTS idx_spans_evalrun_inputhash ON spans(evaluation_run_id, input_hash);
