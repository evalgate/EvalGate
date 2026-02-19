import { encryption } from "@/lib/security/encryption";

type EncryptedWebhookSecret = {
  encryptedSecret: string | null;
  secretIv: string | null;
  secretTag: string | null;
  secret?: string | null;
};

const LEGACY_PLACEHOLDER = "[encrypted]";

function deriveWebhookEncryptionKey(organizationId: number): string {
  const baseKey = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
  if (!baseKey) {
    throw new Error(
      "PROVIDER_KEY_ENCRYPTION_KEY environment variable is required for webhook secret encryption",
    );
  }
  return encryption.deriveKey(baseKey, `webhook-org-${organizationId}`, 100000);
}

export function encryptWebhookSecret(
  organizationId: number,
  secret: string,
): {
  encryptedSecret: string;
  secretIv: string;
  secretTag: string;
  secretPlaceholder: string;
} {
  const key = deriveWebhookEncryptionKey(organizationId);
  const encrypted = encryption.encrypt(secret, key);
  return {
    encryptedSecret: encrypted.encrypted,
    secretIv: encrypted.iv,
    secretTag: encrypted.tag,
    secretPlaceholder: LEGACY_PLACEHOLDER,
  };
}

export function decryptWebhookSecret(
  organizationId: number,
  payload: EncryptedWebhookSecret,
): string | null {
  if (payload.encryptedSecret && payload.secretIv && payload.secretTag) {
    const key = deriveWebhookEncryptionKey(organizationId);
    const decrypted = encryption.decrypt(
      {
        encrypted: payload.encryptedSecret,
        iv: payload.secretIv,
        tag: payload.secretTag,
      },
      key,
    );
    if (!decrypted.success) {
      throw new Error(decrypted.error || "Failed to decrypt webhook secret");
    }
    return decrypted.decrypted;
  }

  if (payload.secret && payload.secret !== LEGACY_PLACEHOLDER) {
    return payload.secret;
  }

  return null;
}
