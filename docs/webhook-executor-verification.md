# Webhook Executor — Receiver Verification

When you use the **webhook executor**, EvalAI sends test inputs to your endpoint. If you configure a `secret`, requests are signed with HMAC-SHA256. Use this guide to verify authenticity and prevent replay attacks.

## Headers Sent by EvalAI

| Header | Description |
|--------|-------------|
| `X-EvalGate-Timestamp` | ISO 8601 timestamp when the request was created |
| `X-EvalGate-Signature` | `sha256=<hex>` HMAC of `timestamp + "." + rawBody` |
| `X-EvalGate-Idempotency-Key` | Deterministic key per test case attempt (for deduplication) |
| `Content-Type` | `application/json` |

## Verification Steps

### 1. Replay window (clock skew)

Reject requests if the timestamp is too old or too new. Recommended: **±5 minutes**.

```typescript
const SKEW_SECONDS = 5 * 60; // 5 minutes

function isTimestampValid(timestamp: string): boolean {
  const ts = new Date(timestamp).getTime();
  const now = Date.now();
  return Math.abs(now - ts) <= SKEW_SECONDS * 1000;
}

// In your handler:
const timestamp = req.headers.get('x-evalai-timestamp');
if (!timestamp || !isTimestampValid(timestamp)) {
  return new Response('Timestamp out of window', { status: 401 });
}
```

### 2. HMAC verification

Verify the signature using the raw request body and your secret:

```typescript
import crypto from 'crypto';

function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const payloadToSign = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');
  const received = signature.replace(/^sha256=/, '');
  return crypto.timingSafeEqual(
    Buffer.from(received, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// Read raw body (do NOT parse JSON first — sign exact bytes)
const rawBody = await req.text();
const timestamp = req.headers.get('x-evalai-timestamp') ?? '';
const signature = req.headers.get('x-evalai-signature') ?? '';

if (!verifySignature(rawBody, timestamp, signature, process.env.WEBHOOK_SECRET!)) {
  return new Response('Invalid signature', { status: 401 });
}
```

### 3. Idempotency deduplication

Use `X-EvalGate-Idempotency-Key` to deduplicate retries. The key is deterministic per `(evaluationRunId, testCaseId, inputHash)`, so retries produce the same key.

- Store processed keys (e.g. in Redis or DB) with a TTL (e.g. 1 hour)
- If the key was already processed, return the cached response instead of re-running

```typescript
const idempotencyKey = req.headers.get('x-evalai-idempotency-key');
if (idempotencyKey && await cache.has(idempotencyKey)) {
  return Response.json(await cache.get(idempotencyKey));
}
// ... process request ...
await cache.set(idempotencyKey, result, { ttl: 3600 });
```

## Summary

| Check | Purpose |
|-------|---------|
| Timestamp ±5 min | Prevent replay attacks |
| HMAC signature | Verify request authenticity |
| Idempotency key | Deduplicate retries |
