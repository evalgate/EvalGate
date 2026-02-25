# Share & Export Security

Threat model, redaction strategy, and controls for the export and sharing features.

## Threat Model

### Assets at Risk

| Asset | Where it lives | Sensitivity |
|-------|---------------|-------------|
| Evaluation prompts | `testResults[].input` | Medium — may contain proprietary prompts |
| LLM outputs | `testResults[].output` | Medium — may contain generated PII |
| Golden eval cases | `evals/golden/cases.json` | Low — designed to be committed |
| Quality scores | `qualityScore.*` | Low — aggregate metrics |
| API keys | Environment variables only | **Critical** — never in exports |
| User identifiers | `generatedBy`, `updatedBy` | Low — OS username only |
| Organization data | `organizationId` | Low — opaque ID |

### Threat Matrix

| # | Threat | Vector | Impact | Mitigation |
|---|--------|--------|--------|------------|
| T1 | PII leakage in shared exports | LLM outputs contain names/emails/SSNs | High | Redaction scrubber (see below) |
| T2 | Prompt exfiltration | Shared demo exposes proprietary eval prompts | Medium | Review before publish; prompt field optional |
| T3 | Enumeration of share IDs | Attacker guesses share URLs | Low | IDs are 10-char hex (>1 trillion combinations) |
| T4 | Stale shared data | Published demo contains outdated/wrong results | Low | Expiration support; unpublish API |
| T5 | XSS via export data | Malicious content in test inputs/outputs | Medium | All fields HTML-escaped on render; CSP headers |
| T6 | Size-based DoS | Export with millions of test cases | Low | 10MB export size limit; pagination on render |
| T7 | IDOR on export endpoint | User exports another org's evaluation | High | `requireAuthWithOrg` middleware on all export routes |
| T8 | API key in export | Key accidentally included in JSON | **Critical** | Export serializer excludes all `*key*`, `*token*`, `*secret*` fields |

## Redaction Strategy

### Automatic Redaction (applied on export)

The export serializer scrubs known PII patterns before writing JSON:

| Pattern | Example | Replacement |
|---------|---------|-------------|
| Email addresses | `john@example.com` | `[EMAIL]` |
| SSN | `123-45-6789` | `[SSN]` |
| Phone numbers | `(555) 123-4567` | `[PHONE]` |
| Credit card numbers | `4111 1111 1111 1111` | `[CARD]` |
| API keys | `sk-proj-abc123...` | `[REDACTED]` |
| Bearer tokens | `Bearer eyJ...` | `[REDACTED]` |

### Manual Redaction Recommendations

Before publishing a shared demo:

1. **Review test inputs** — Remove proprietary prompt text if sensitive
2. **Review test outputs** — LLM responses may contain PII from training data
3. **Check custom fields** — Any `metadata` or `notes` fields you added
4. **Remove internal URLs** — Staging/internal API endpoints in test cases

### Redaction in CI Artifacts

Regression reports uploaded as CI artifacts (`evals/regression-report.json`) contain:
- Metric names and scores (safe)
- Failure descriptions (review for PII)
- Baseline metadata (OS username — typically safe)

They do **not** contain:
- Raw test inputs/outputs
- API keys or tokens
- LLM conversation history

## Access Controls

### Export Endpoint

```
GET /api/evaluations/:id/export
```

- **Auth**: Requires valid session + org membership
- **Scope**: Can only export evaluations owned by your organization
- **Rate limit**: 10 exports/minute per user
- **Size limit**: 10MB per export

### Publish (Share) Endpoint

```
POST /api/evaluations/:id/publish
```

- **Auth**: Requires valid session + org membership
- **Scope**: Can only publish evaluations owned by your organization
- **Share ID**: Auto-generated (10-char hex) or custom (validated: `[a-z0-9-]`)
- **Immutable**: Published data cannot be edited — only unpublished

### Unpublish Endpoint

```
DELETE /api/evaluations/:id/publish?shareId=...
```

- **Auth**: Same org as the original publisher
- **Effect**: Removes from `sharedExports` table; share URL returns 410

### Share Page (Public)

```
GET /share/:shareId
```

- **Auth**: None (public by design)
- **Data**: Read-only snapshot of evaluation at publish time
- **No auth tokens**: Share page never exposes API keys or session tokens
- **CSP**: `Content-Security-Policy` header prevents inline script injection

## CLI Share (`evalai share`)

The `evalai share` command creates time-limited share links:

```bash
evalai share --scope run --evaluationId 42 --runId 123 --expires 7d
```

| Flag | Effect |
|------|--------|
| `--expires <duration>` | Link expires after duration (e.g., `7d`, `24h`) |
| `--scope run` | Shares a single run, not the entire evaluation |
| `--scope evaluation` | Shares the full evaluation |

Expired links return `410 Gone`.

## Hard Defaults

These two defaults are **on by default** and require explicit opt-out.

### 1. Share Expiry: 7 days

All shared links expire after **7 days** unless overridden:

```bash
evalai share --scope run --evaluationId 42 --runId 123                 # expires in 7 days (default)
evalai share --scope run --evaluationId 42 --runId 123 --expires 30d   # override to 30 days
evalai share --scope run --evaluationId 42 --runId 123 --expires never # no expiry (not recommended)
```

Via API:

```json
POST /api/evaluations/:id/publish
{ "expiresIn": "7d" }           // default
{ "expiresIn": "30d" }          // override
{ "expiresIn": null }           // no expiry (requires org admin)
```

After expiry, the share URL returns `410 Gone`. The data remains in the database for 30 days (soft delete) before permanent removal.

### 2. Redaction: On by Default

The export serializer applies PII redaction **automatically** on every export and publish. To opt out:

```json
POST /api/evaluations/:id/publish
{ "redact": false }             // opt out — requires org admin role
```

```bash
evalai share --no-redact        # opt out via CLI — prints a warning
```

When redaction is disabled:
- A warning is logged to the audit trail: `"redaction_disabled_by": "<userId>"`
- The share page banner shows: "This export has not been redacted"
- The org admin is notified via email

**Recommendation:** Never disable redaction for public shares. Only disable for internal team shares where raw data is needed for debugging.

## Recommendations for Operators

1. **Enable CODEOWNERS** for `evals/` directory — baseline changes require review
2. **Audit shared exports** periodically — list all with `/api/admin/shared-exports`
3. **Set expiration policy** — auto-expire shares older than 90 days
4. **Monitor export volume** — unusual spikes may indicate data exfiltration
5. **Review before publish** — always check the export JSON for PII before making it public

## Incident Response

If sensitive data is found in a shared export:

1. **Unpublish immediately** — `DELETE /api/evaluations/:id/publish?shareId=...`
2. **Check access logs** — How many times was the share URL accessed?
3. **Notify affected parties** — If PII was exposed
4. **File a security advisory** — See [SECURITY.md](../SECURITY.md) for the process
