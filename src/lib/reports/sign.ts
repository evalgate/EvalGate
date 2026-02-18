/**
 * Report HMAC signing and verification.
 */

import crypto from "node:crypto";

/**
 * Sign a report payload with HMAC-SHA256.
 */
export function signReport(payload: object, secret: string): { body: string; sig: string } {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return { body, sig };
}

/**
 * Verify an HMAC-SHA256 signature on a report body.
 */
export function verifyReport(body: string, sig: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Derive an org-specific signing secret from the base key.
 */
export function deriveReportSecret(orgId: number): string {
  const baseKey = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
  if (!baseKey) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_KEY required for report signing");
  }
  return crypto.createHmac("sha256", baseKey).update(`report-sign-org-${orgId}`).digest("hex");
}
