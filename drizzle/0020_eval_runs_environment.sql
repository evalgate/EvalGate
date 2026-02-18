-- Environment for evaluation runs: dev | staging | prod (for baseline=production)
ALTER TABLE evaluation_runs ADD COLUMN environment TEXT DEFAULT 'dev';
