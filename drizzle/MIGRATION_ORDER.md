# Migration Order & Table Dependencies

## Table Creation Order (by migration)

| Migration | Tables Created | Tables Altered |
|-----------|----------------|----------------|
| 0000 | account, session, user, verification | — |
| 0001 | annotation_items, annotation_tasks, evaluation_runs, evaluation_test_cases, evaluations, llm_judge_configs, llm_judge_results, organization_members, organizations, trace_spans, traces | — |
| 0002 | — | annotation_tasks, evaluations, llm_judge_configs |
| 0003 | api_keys, api_usage_logs, webhook_deliveries, webhooks | — |
| 0004 | human_annotations, spans, test_cases, test_results | — |
| 0005 | — | indexes only (camelCase columns – may not match) |
| 0006 | — | indexes only |
| 0007 | email_subscribers | — |
| 0008_add_llm_judge_result_fks | — | llm_judge_results |
| 0008_add_organization_id | — | evaluation_runs, test_results |
| 0008_add_organization_id_workflow_tables | — | workflow_runs, agent_handoffs, agent_decisions, cost_records, audit_logs |
| 0009 | — | UPDATE backfill (org_id) |
| 0010 | — | INSERT into test_cases |
| 0011 | — | CREATE UNIQUE INDEX (org_members, api_keys) |
| 0012_add_cost_eval_run_id | — | cost_records |
| 0012_create_quality_scores | quality_scores | — |
| 0013 | — | quality_scores |
| 0014 | — | spans, test_cases, test_results |
| 0015 | — | indexes |
| 0016 | — | indexes (spans) |
| 0017 | — | quality_scores |
| 0018 | — | indexes (spans) |
| 0019 | — | quality_scores |
| 0020 | — | evaluation_runs |
| 0021 | — | test_results |
| 0022 | — | quality_scores |

## Tables NOT created by migrations (created via drizzle-kit push)

- workflow_runs, workflows, agent_handoffs, agent_decisions, cost_records, audit_logs, agent_configs, etc.

## Known skip conditions (run-migrations.ts)

- `duplicate column` – column already added
- `already exists` – index/table already exists
- `no such table` – table from schema not yet in migrations
- `no such column` – index references column with different casing (e.g. 0005 camelCase vs snake_case)
- `UNIQUE constraint failed` – data has duplicates; constraint cannot be applied
