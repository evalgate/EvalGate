# Platform SLOs (Service Level Objectives)

This document defines the 5 core SLOs for the AI evaluation platform, including targets, measurement queries, and alert thresholds. The `/api/metrics/slo` endpoint computes these values over a rolling 24-hour window.

## SLO Definitions

| SLO | Target | Alert threshold | Measurement source | Sentry alert type |
|---|---|---|---|---|
| API p95 latency — public routes | ≤ 500 ms | > 800 ms sustained 5 min | `apiUsageLogs.responseTimeMs` WHERE `userId IS NULL` | Performance issue alert |
| API p95 latency — authed routes | ≤ 1 000 ms | > 2 000 ms sustained 5 min | `apiUsageLogs.responseTimeMs` WHERE `userId IS NOT NULL` | Performance issue alert |
| 5xx error rate | < 1 % | > 2 % over 10 min | `apiUsageLogs.statusCode >= 500` | Error rate alert |
| Webhook delivery success rate | ≥ 95 % | < 90 % over 1 h | `webhookDeliveries.status = 'success'` | Custom metric alert |
| Eval gate pass rate | ≥ 70 % pass | < 50 % pass over 24 h | `qualityScores.score >= 70` | Custom metric alert |

## Measurement Queries

### API p95 latency (public/authed)
```sql
-- Public routes (no userId)
SELECT responseTimeMs FROM apiUsageLogs 
WHERE userId IS NULL AND createdAt >= datetime('now', '-24 hours')
ORDER BY responseTimeMs DESC 
LIMIT 1 OFFSET floor(count * 0.05)

-- Authed routes (has userId)  
SELECT responseTimeMs FROM apiUsageLogs 
WHERE userId IS NOT NULL AND createdAt >= datetime('now', '-24 hours')
ORDER BY responseTimeMs DESC 
LIMIT 1 OFFSET floor(count * 0.05)
```

### 5xx error rate
```sql
SELECT 
  COUNT(CASE WHEN statusCode >= 500 THEN 1 END) * 100.0 / COUNT(*) as errorRate
FROM apiUsageLogs 
WHERE createdAt >= datetime('now', '-24 hours')
```

### Webhook delivery success rate
```sql
SELECT 
  COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*) as successRate
FROM webhookDeliveries 
WHERE createdAt >= datetime('now', '-24 hours')
```

### Eval gate pass rate
```sql
SELECT 
  COUNT(CASE WHEN score >= 70 THEN 1 END) * 100.0 / COUNT(*) as passRate
FROM qualityScores 
WHERE createdAt >= datetime('now', '-24 hours')
```

## Alert Configuration

### Sentry Setup Steps

1. **Performance alerts** (API latency)
   - Create "Issue Alert" for `transaction.duration` > 800ms (public) or > 2000ms (authed)
   - Set "Alert if issue happens more than 5 times in 5 minutes"
   - Filter by `request.url` patterns to separate public vs authed routes

2. **Error rate alert**
   - Create "Metric Alert" for `percentage of errors` > 2%
   - Set "Alert if condition is met for 10 minutes"
   - Use `transaction.name` = `*` to cover all routes

3. **Custom metric alerts** (webhooks + eval gates)
   - Create "Metric Alert" for `webhook_success_rate` < 90%
   - Create "Metric Alert" for `eval_gate_pass_rate` < 50%
   - Set appropriate time windows (1h for webhooks, 24h for eval gates)

## Environment Variables Required

For Phase 4 cron monitoring:
- `CRON_SECRET` — Secret token for `/api/cron/health` endpoint authentication
- Add to Vercel Environment Variables and `.env.example`

## Operational Monitoring

### Cron Health Check
- Endpoint: `GET /api/cron/health` (authenticated via `Authorization: Bearer $CRON_SECRET`)
- Schedule: Every 5 minutes via Vercel Cron
- Alert: Sentry Cron Monitor if check-in missed for 2 consecutive intervals (10 min)

### Manual SLO Check
- Endpoint: `GET /api/metrics/slo` (admin-only)
- Returns: Current SLO values with breach status
- Use for quick "did yesterday get worse?" assessment

## Data Retention Notes

- `apiUsageLogs` and `webhookDeliveries` use `text("created_at")` (ISO strings)
- ISO 8601 string comparisons work correctly in SQLite for date range filtering
- No migration required for Phase 0 queries

## Future Improvements

- Add `api_usage_logs(created_at)` index in Phase 3 to improve SLO query performance
- Consider adding p99 latency metrics for deeper performance analysis
- Add trend analysis (week-over-week) to SLO dashboard
