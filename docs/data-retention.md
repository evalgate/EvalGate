# Data Retention & Privacy Guarantees

This document describes what data the EvalGate stores, retention windows, deletion workflows, and what is and is not persisted.

---

## Summary

| Data Type | Retention | Deletion | Persisted |
|-----------|-----------|----------|-----------|
| Shared exports (share links) | Optional expiry (`expiresInDays`) or indefinite | Revoke (immediate) or expiry (automatic) | Yes, until revoked/expired |
| Evaluation runs & results | Indefinite (org-owned) | Org deletion cascades | Yes |
| API keys | Optional expiry or indefinite | Revoke (immediate) | Yes |
| Traces & spans | Indefinite | Org deletion cascades | Yes |
| Session tokens | Per auth provider | Logout / expiry | Yes, until expiry |

---

## Shared Exports (Share Links)

### Model

- **`expiresAt`**: Optional ISO 8601 datetime. If set, the share link returns `410 Gone` after this time.
- **`revokedAt`**: Set when an org admin unpublishes the share. Access is removed **immediately**.
- **`isPublic`**: If `false`, returns `410 Gone` (share unavailable).

### Retention Windows

- **No expiry**: If `expiresInDays` is not set when publishing, the share has no expiration.
- **With expiry**: `expiresAt = now + expiresInDays * 24h`. After that, `GET /api/exports/[shareId]` returns `410` with code `SHARE_EXPIRED`.

### Deletion / Revocation Workflow

1. **Revoke (unpublish)**: `DELETE /api/evaluations/[id]/publish?shareId=...`
   - Sets `revokedAt`, `revokedBy`, optionally `revokedReason`.
   - Next `GET /api/exports/[shareId]` returns `410` with code `SHARE_REVOKED`.
   - **Immediate**: No grace period; access is denied on the next request.

2. **Expiry**: Automatic. No cron job required; each `GET` checks `expiresAt < now` and returns `410` if expired.

### What Is Persisted

- Export payload (sanitized, no secrets)
- Share metadata: `shareId`, `organizationId`, `evaluationId`, `evaluationRunId`, `shareScope`, `exportHash`, `createdAt`, `updatedAt`, `expiresAt`, `revokedAt`, `viewCount`

### What Is Not Persisted in Exports

- API keys, tokens, or credentials
- Raw PII beyond what the user explicitly includes in export data
- Internal debug or audit fields (e.g. `revokedReason` is never exposed in public responses)

---

## API Keys

- **`expiresAt`**: Optional. Expired keys are rejected at auth time.
- **Revocation**: `DELETE /api/developer/api-keys/[id]` (or revoke endpoint) sets `revokedAt`. Rejected **immediately** on next use.

---

## Evaluations, Runs, Test Cases

- Owned by organization. No automatic retention limit.
- Deletion: When an organization is deleted, related data is cascaded (per schema).
- Export data in share links is a **copy** at publish time; revoking a share does not delete the underlying evaluation or run.

---

## Audit Assertions

Run `pnpm audit:retention` to verify:

1. Exports include `expiresAt` in the response when set
2. Expired exports return `410` with code `SHARE_EXPIRED`
3. Revoked exports return `410` with code `SHARE_REVOKED`
4. Deletion/revocation removes access immediately (no cached 200)
