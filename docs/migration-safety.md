# Migration Safety

Migrations are forward-only, idempotent, and verified in CI.

## Invariants

1. **Forward-only:** Migrations run in numerical order. No rollbacks.
2. **Idempotent:** Re-running a migration skips already-applied statements (e.g. "column already exists").
3. **No data loss:** Migrations add columns/tables; destructive changes are rare and documented.

## CI Verification

`pnpm audit:migrations`:

1. Creates a temp SQLite DB
2. Runs all migrations (0000 through latest)
3. Runs sanity queries on key tables: `organizations`, `evaluations`, `evaluation_runs`, `test_cases`, `shared_exports`
4. Exits 0 on success

This runs in Platform CI on every push/PR.

## Webhook Secret Encryption (0033)

Migration `0033_webhook_secret_encryption.sql` adds `encrypted_secret`, `secret_iv`, and `secret_tag`
columns to the `webhooks` table. The existing `secret` column is preserved for backward compatibility.

**Safety invariant:** Plaintext legacy secrets are encrypted lazily on next update (PATCH with
`secret` field) or on next delivery (the `decryptWebhookSecret` helper falls back to reading the
plaintext `secret` column when the encrypted columns are NULL). A bulk backfill script can be run
separately to encrypt all rows at rest — see `webhook-secrets.ts` for the encrypt/decrypt helpers.

## Running Locally

```bash
pnpm audit:migrations
```

Requires no env vars (uses temp file DB).
