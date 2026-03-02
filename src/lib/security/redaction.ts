/**
 * Redaction — Configurable field scrubbing and PII masking pipeline.
 *
 * Redaction runs before any trace snapshot is frozen or exported.
 * Default policy: redact known secret patterns + common PII fields.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type RedactionMode = "mask" | "remove" | "hash";

export interface RedactionRule {
	/** Field path pattern (dot-notation, supports wildcards: *) */
	field: string;
	mode: RedactionMode;
	/** Optional: only apply if field value matches this regex */
	matchPattern?: string;
}

export interface RedactionProfile {
	id: string;
	name: string;
	/** Apply built-in secret scanning on all string values */
	secretScanning: boolean;
	/** Apply built-in PII field matching */
	piiFieldMatching: boolean;
	/** Additional custom rules */
	rules: RedactionRule[];
}

export interface RedactionResult {
	redacted: boolean;
	fieldsRedacted: string[];
	secretsFound: number;
}

// ── Default mask value ───────────────────────────────────────────────────────

export const REDACTION_MASK = "[REDACTED]";

// ── Built-in PII field names ─────────────────────────────────────────────────

const PII_FIELD_PATTERNS = [
	/^(email|emailAddress|email_address)$/i,
	/^(phone|phoneNumber|phone_number)$/i,
	/^(ssn|socialSecurityNumber|social_security_number)$/i,
	/^(password|passwd|secret|token|apiKey|api_key|accessToken|access_token|refreshToken|refresh_token|privateKey|private_key)$/i,
	/^(creditCard|credit_card|cardNumber|card_number|cvv|cvc)$/i,
	/^(dateOfBirth|dob|date_of_birth|birthDate|birth_date)$/i,
	/^(address|streetAddress|street_address|zipCode|zip_code|postalCode|postal_code)$/i,
	/^(ipAddress|ip_address|userIp|user_ip)$/i,
];

function isPiiField(fieldName: string): boolean {
	return PII_FIELD_PATTERNS.some((p) => p.test(fieldName));
}

// ── Default profiles ─────────────────────────────────────────────────────────

export const DEFAULT_REDACTION_PROFILE: RedactionProfile = {
	id: "default",
	name: "Default (secrets + common PII)",
	secretScanning: true,
	piiFieldMatching: true,
	rules: [],
};

export const STRICT_REDACTION_PROFILE: RedactionProfile = {
	id: "strict",
	name: "Strict (all personally identifiable fields)",
	secretScanning: true,
	piiFieldMatching: true,
	rules: [
		{ field: "userId", mode: "hash" },
		{ field: "sessionId", mode: "hash" },
		{ field: "metadata.userId", mode: "hash" },
	],
};

export const NO_REDACTION_PROFILE: RedactionProfile = {
	id: "none",
	name: "No redaction (internal use only)",
	secretScanning: false,
	piiFieldMatching: false,
	rules: [],
};

// ── Core redaction functions ──────────────────────────────────────────────────

import { scanForSecrets } from "./secret-scanner";

/**
 * Apply redaction to a plain object (trace payload, span payload, metadata).
 * Returns a deep copy with redacted fields.
 */
export function redactObject(
	obj: Record<string, unknown>,
	profile: RedactionProfile = DEFAULT_REDACTION_PROFILE,
	_path = "",
): { result: Record<string, unknown>; redactionResult: RedactionResult } {
	const redacted: Record<string, unknown> = {};
	const fieldsRedacted: string[] = [];
	let secretsFound = 0;

	for (const [key, value] of Object.entries(obj)) {
		const fieldPath = _path ? `${_path}.${key}` : key;

		// Check explicit rules first (most specific wins)
		const matchingRule = findMatchingRule(key, fieldPath, profile.rules);
		if (matchingRule) {
			redacted[key] = applyMode(
				value,
				matchingRule.mode,
				matchingRule.matchPattern,
			);
			fieldsRedacted.push(fieldPath);
			continue;
		}

		// PII field matching
		if (profile.piiFieldMatching && isPiiField(key)) {
			redacted[key] = REDACTION_MASK;
			fieldsRedacted.push(fieldPath);
			continue;
		}

		// Secret scanning on string values
		if (profile.secretScanning && typeof value === "string") {
			const scan = scanForSecrets(value);
			if (scan.found) {
				redacted[key] = scan.redacted;
				fieldsRedacted.push(fieldPath);
				secretsFound += scan.count;
				continue;
			}
		}

		// Recurse into nested objects
		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			const nested = redactObject(
				value as Record<string, unknown>,
				profile,
				fieldPath,
			);
			redacted[key] = nested.result;
			fieldsRedacted.push(...nested.redactionResult.fieldsRedacted);
			secretsFound += nested.redactionResult.secretsFound;
			continue;
		}

		// Recurse into arrays
		if (Array.isArray(value)) {
			const { arr, fields, secrets } = redactArray(value, profile, fieldPath);
			redacted[key] = arr;
			fieldsRedacted.push(...fields);
			secretsFound += secrets;
			continue;
		}

		redacted[key] = value;
	}

	return {
		result: redacted,
		redactionResult: {
			redacted: fieldsRedacted.length > 0 || secretsFound > 0,
			fieldsRedacted,
			secretsFound,
		},
	};
}

/**
 * Redact a string value directly (scans for secrets).
 */
export function redactString(
	value: string,
	profile: RedactionProfile = DEFAULT_REDACTION_PROFILE,
): { result: string; secretsFound: number } {
	if (!profile.secretScanning) return { result: value, secretsFound: 0 };
	const scan = scanForSecrets(value);
	return { result: scan.redacted, secretsFound: scan.count };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findMatchingRule(
	fieldName: string,
	fieldPath: string,
	rules: RedactionRule[],
): RedactionRule | null {
	for (const rule of rules) {
		const pattern = rule.field.replace(/\./g, "\\.").replace(/\*/g, "[^.]+");
		const regex = new RegExp(`^${pattern}$`, "i");
		if (regex.test(fieldName) || regex.test(fieldPath)) {
			return rule;
		}
	}
	return null;
}

function applyMode(
	value: unknown,
	mode: RedactionMode,
	matchPattern?: string,
): unknown {
	if (matchPattern && typeof value === "string") {
		if (!new RegExp(matchPattern).test(value)) return value;
	}

	switch (mode) {
		case "mask":
			return REDACTION_MASK;
		case "remove":
			return undefined;
		case "hash": {
			if (typeof value !== "string") return REDACTION_MASK;
			// Simple deterministic hash for non-cryptographic deduplication
			let hash = 0;
			for (let i = 0; i < value.length; i++) {
				hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
			}
			return `[HASH:${Math.abs(hash).toString(16).padStart(8, "0")}]`;
		}
		default:
			return REDACTION_MASK;
	}
}

function redactArray(
	arr: unknown[],
	profile: RedactionProfile,
	pathPrefix: string,
): { arr: unknown[]; fields: string[]; secrets: number } {
	const result: unknown[] = [];
	const fields: string[] = [];
	let secrets = 0;

	for (let i = 0; i < arr.length; i++) {
		const item = arr[i];
		const itemPath = `${pathPrefix}[${i}]`;

		if (item !== null && typeof item === "object" && !Array.isArray(item)) {
			const nested = redactObject(
				item as Record<string, unknown>,
				profile,
				itemPath,
			);
			result.push(nested.result);
			fields.push(...nested.redactionResult.fieldsRedacted);
			secrets += nested.redactionResult.secretsFound;
		} else if (typeof item === "string" && profile.secretScanning) {
			const scan = scanForSecrets(item);
			result.push(scan.redacted);
			if (scan.found) {
				fields.push(itemPath);
				secrets += scan.count;
			}
		} else {
			result.push(item);
		}
	}

	return { arr: result, fields, secrets };
}
