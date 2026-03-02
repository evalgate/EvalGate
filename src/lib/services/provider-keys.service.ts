// src/lib/services/provider-keys.service.ts

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, providerKeys } from "@/db/schema";
import { logger } from "@/lib/logger";
import { encryption } from "@/lib/security/encryption";

export const createProviderKeySchema = z.object({
	provider: z.string().min(1),
	keyName: z.string().min(1).max(255),
	keyType: z.enum(["api_key", "oauth_token", "service_account"]),
	apiKey: z.string().min(1),
	metadata: z.record(z.unknown()).optional(),
});

export const updateProviderKeySchema = z.object({
	keyName: z.string().min(1).max(255).optional(),
	metadata: z.record(z.unknown()).optional(),
	isActive: z.boolean().optional(),
});

export type CreateProviderKeyInput = z.infer<typeof createProviderKeySchema>;
export type UpdateProviderKeyInput = z.infer<typeof updateProviderKeySchema>;

export interface DecryptedProviderKey {
	id: number;
	organizationId: number;
	provider: string;
	keyName: string;
	keyType: string;
	keyPrefix: string;
	decryptedKey: string;
	metadata: Record<string, unknown>;
	isActive: boolean;
	lastUsedAt: Date | null;
	expiresAt: Date | null;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Provider Keys Service
 * Manages encrypted third-party API keys for organizations.
 */
export class ProviderKeysService {
	/**
	 * Create a new encrypted provider key.
	 */
	async createProviderKey(
		organizationId: number,
		input: CreateProviderKeyInput,
		createdBy: string,
	): Promise<{
		id: number;
		provider: string;
		keyName: string;
		keyType: string;
		keyPrefix: string;
	}> {
		logger.info("Creating provider key", {
			organizationId,
			provider: input.provider,
			keyName: input.keyName,
		});

		// Verify organization exists
		const [org] = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);

		if (!org) {
			throw new Error("Organization not found");
		}

		// Check for master encryption key
		const masterKey = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
		if (!masterKey) {
			throw new Error(
				"PROVIDER_KEY_ENCRYPTION_KEY environment variable is required. " +
					"Generate a strong secret and set it in your .env file.",
			);
		}

		// Generate encryption key for this organization (or use existing)
		const encryptionKey = await this.getOrCreateEncryptionKey(organizationId);

		// Encrypt the API key
		const encrypted = encryption.encrypt(input.apiKey, encryptionKey);

		// Generate key prefix (first few characters for identification)
		const keyPrefix = `${input.apiKey.substring(0, 4)}...`;

		// Save to database
		const [result] = await db
			.insert(providerKeys)
			.values({
				organizationId,
				provider: input.provider,
				keyName: input.keyName,
				keyType: input.keyType,
				encryptedKey: encrypted.encrypted,
				keyPrefix,
				iv: encrypted.iv,
				tag: encrypted.tag,
				metadata: (input.metadata ||
					{}) as import("@/db/types").ProviderKeyMetadata,
				isActive: true,
				createdBy,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({
				id: providerKeys.id,
				provider: providerKeys.provider,
				keyName: providerKeys.keyName,
				keyType: providerKeys.keyType,
				keyPrefix: providerKeys.keyPrefix,
			});

		logger.info("Provider key created successfully", {
			id: result.id,
			organizationId,
			provider: result.provider,
		});

		return result;
	}

	/**
	 * List provider keys for an organization.
	 */
	async listProviderKeys(
		organizationId: number,
		options?: {
			provider?: string;
			includeInactive?: boolean;
		},
	): Promise<
		Array<{
			id: number;
			provider: string;
			keyName: string;
			keyType: string;
			keyPrefix: string;
			isActive: boolean | null;
			lastUsedAt: Date | null;
			expiresAt: Date | null;
			createdAt: Date;
			updatedAt: Date;
		}>
	> {
		const { provider, includeInactive = false } = options || {};

		const conditions = [eq(providerKeys.organizationId, organizationId)];
		if (provider) {
			conditions.push(eq(providerKeys.provider, provider));
		}
		if (!includeInactive) {
			conditions.push(eq(providerKeys.isActive, true));
		}

		return db
			.select({
				id: providerKeys.id,
				provider: providerKeys.provider,
				keyName: providerKeys.keyName,
				keyType: providerKeys.keyType,
				keyPrefix: providerKeys.keyPrefix,
				isActive: providerKeys.isActive,
				lastUsedAt: providerKeys.lastUsedAt,
				expiresAt: providerKeys.expiresAt,
				createdAt: providerKeys.createdAt,
				updatedAt: providerKeys.updatedAt,
			})
			.from(providerKeys)
			.where(and(...conditions))
			.orderBy(providerKeys.createdAt);
	}

	/**
	 * Get a decrypted provider key.
	 */
	async getProviderKey(
		organizationId: number,
		keyId: number,
	): Promise<DecryptedProviderKey | null> {
		const [key] = await db
			.select()
			.from(providerKeys)
			.where(
				and(
					eq(providerKeys.id, keyId),
					eq(providerKeys.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!key) {
			return null;
		}

		// Get encryption key for this organization
		const encryptionKey = await this.getEncryptionKey(organizationId);
		if (!encryptionKey) {
			throw new Error("Encryption key not found for organization");
		}

		// Decrypt the API key
		const decrypted = encryption.decrypt(
			{
				encrypted: key.encryptedKey,
				iv: key.iv,
				tag: key.tag,
			},
			encryptionKey,
		);

		if (!decrypted.success) {
			throw new Error(`Failed to decrypt provider key: ${decrypted.error}`);
		}

		// Update last used timestamp
		await db
			.update(providerKeys)
			.set({ lastUsedAt: new Date() })
			.where(eq(providerKeys.id, keyId));

		return {
			id: key.id,
			organizationId: key.organizationId,
			provider: key.provider,
			keyName: key.keyName,
			keyType: key.keyType,
			keyPrefix: key.keyPrefix,
			decryptedKey: decrypted.decrypted,
			metadata: key.metadata as import("@/db/types").ProviderKeyMetadata,
			isActive: key.isActive ?? true,
			lastUsedAt: key.lastUsedAt,
			expiresAt: key.expiresAt,
			createdBy: key.createdBy,
			createdAt: key.createdAt,
			updatedAt: key.updatedAt,
		};
	}

	/**
	 * Get active provider key for a specific provider.
	 */
	async getActiveProviderKey(
		organizationId: number,
		provider: string,
	): Promise<DecryptedProviderKey | null> {
		const [key] = await db
			.select()
			.from(providerKeys)
			.where(
				and(
					eq(providerKeys.organizationId, organizationId),
					eq(providerKeys.provider, provider),
					eq(providerKeys.isActive, true),
				),
			)
			.orderBy(providerKeys.createdAt)
			.limit(1);

		if (!key) {
			return null;
		}

		return this.getProviderKey(organizationId, key.id);
	}

	/**
	 * Update a provider key.
	 */
	async updateProviderKey(
		organizationId: number,
		keyId: number,
		input: UpdateProviderKeyInput,
	): Promise<{
		id: number;
		keyName: string;
		metadata: Record<string, unknown>;
		isActive: boolean;
		updatedAt: Date;
	}> {
		const [existing] = await db
			.select()
			.from(providerKeys)
			.where(
				and(
					eq(providerKeys.id, keyId),
					eq(providerKeys.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Provider key not found");
		}

		const updateData: {
			updatedAt: Date;
			keyName?: string;
			metadata?: import("@/db/types").ProviderKeyMetadata;
			isActive?: boolean;
		} = {
			updatedAt: new Date(),
		};

		if (input.keyName !== undefined) {
			updateData.keyName = input.keyName;
		}

		if (input.metadata !== undefined) {
			updateData.metadata =
				input.metadata as import("@/db/types").ProviderKeyMetadata;
		}

		if (input.isActive !== undefined) {
			updateData.isActive = input.isActive;
		}

		const returningRes = await db
			.update(providerKeys)
			.set(updateData)
			.where(eq(providerKeys.id, keyId))
			.returning({
				id: providerKeys.id,
				keyName: providerKeys.keyName,
				metadata: providerKeys.metadata,
				isActive: providerKeys.isActive,
				updatedAt: providerKeys.updatedAt,
			});

		const result = Array.isArray(returningRes) ? returningRes[0] : returningRes;
		if (!result) {
			throw new Error("Provider key not found");
		}

		logger.info("Provider key updated", { keyId, organizationId });

		return {
			id: result.id,
			keyName: result.keyName,
			metadata:
				(result.metadata as import("@/db/types").ProviderKeyMetadata) || {},
			isActive: result.isActive ?? true,
			updatedAt: result.updatedAt,
		};
	}

	/**
	 * Delete a provider key.
	 */
	async deleteProviderKey(
		organizationId: number,
		keyId: number,
	): Promise<void> {
		const [existing] = await db
			.select()
			.from(providerKeys)
			.where(
				and(
					eq(providerKeys.id, keyId),
					eq(providerKeys.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error("Provider key not found");
		}

		await db.delete(providerKeys).where(eq(providerKeys.id, keyId));

		logger.info("Provider key deleted", { keyId, organizationId });
	}

	/**
	 * Get or create encryption key for an organization.
	 */
	private async getOrCreateEncryptionKey(
		organizationId: number,
	): Promise<string> {
		const baseKey = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
		if (!baseKey) {
			throw new Error(
				"PROVIDER_KEY_ENCRYPTION_KEY environment variable is required. " +
					"Generate a strong secret and set it in your .env file.",
			);
		}
		const salt = `org-${organizationId}`;

		return encryption.deriveKey(baseKey, salt, 100000);
	}

	/**
	 * Get encryption key for an organization.
	 */
	private async getEncryptionKey(
		organizationId: number,
	): Promise<string | null> {
		try {
			return await this.getOrCreateEncryptionKey(organizationId);
		} catch (error) {
			logger.error("Failed to get encryption key", { organizationId, error });
			return null;
		}
	}

	/**
	 * Validate provider key format.
	 */
	validateProviderKey(provider: string, apiKey: string): boolean {
		const p = provider.toLowerCase();
		const patterns: Record<string, RegExp> = {
			openai: /^sk-[A-Za-z0-9]{48}$/,
			// accept api03/api04/... and variable length tokens
			anthropic: /^sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}$/,
			google: /^[A-Za-z0-9_-]{39}$/,
			cohere: /^[A-Za-z0-9]{40}$/,
			huggingface: /^hf_[A-Za-z0-9]{34}$/,
		};

		const pattern = patterns[p];
		if (!pattern) {
			// For unknown providers, just check basic requirements
			return apiKey.length >= 20;
		}

		return pattern.test(apiKey);
	}

	/**
	 * Get provider key statistics.
	 */
	async getProviderKeyStats(organizationId: number): Promise<{
		totalKeys: number;
		activeKeys: number;
		keysByProvider: Record<string, number>;
		recentlyUsed: number;
	}> {
		const keys = await db
			.select({
				provider: providerKeys.provider,
				isActive: providerKeys.isActive,
				lastUsedAt: providerKeys.lastUsedAt,
			})
			.from(providerKeys)
			.where(eq(providerKeys.organizationId, organizationId));

		const totalKeys = keys.length;
		const activeKeys = keys.filter((k) => k.isActive).length;

		const keysByProvider: Record<string, number> = {};
		keys.forEach((key) => {
			keysByProvider[key.provider] = (keysByProvider[key.provider] || 0) + 1;
		});

		const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const recentlyUsed = keys.filter(
			(k) => k.lastUsedAt && new Date(k.lastUsedAt) > oneWeekAgo,
		).length;

		return {
			totalKeys,
			activeKeys,
			keysByProvider,
			recentlyUsed,
		};
	}
}

// Export singleton instance
export const providerKeysService = new ProviderKeysService();
