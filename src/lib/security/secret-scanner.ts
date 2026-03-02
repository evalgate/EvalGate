/**
 * Secret Scanner — Detect API keys, tokens, and passwords in trace content.
 *
 * Default-on in all redaction profiles except NO_REDACTION_PROFILE.
 * Patterns cover the most common secret formats encountered in LLM traces.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SecretMatch {
	pattern: string;
	value: string;
	startIndex: number;
	endIndex: number;
}

export interface ScanResult {
	found: boolean;
	count: number;
	matches: SecretMatch[];
	/** Original string with secrets replaced by [REDACTED] */
	redacted: string;
}

// ── Secret patterns ───────────────────────────────────────────────────────────

interface SecretPattern {
	name: string;
	regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
	// OpenAI
	{ name: "openai-api-key", regex: /sk-[A-Za-z0-9]{20,}/g },
	{ name: "openai-org", regex: /org-[A-Za-z0-9]{20,}/g },
	// Anthropic
	{ name: "anthropic-api-key", regex: /sk-ant-[A-Za-z0-9\-_]{20,}/g },
	// Google
	{ name: "google-api-key", regex: /AIza[A-Za-z0-9\-_]{35}/g },
	// AWS
	{ name: "aws-access-key", regex: /AKIA[A-Z0-9]{16}/g },
	{
		name: "aws-secret-key",
		regex:
			/(?:aws_secret_access_key|AWS_SECRET)[^\s]*\s*[=:]\s*[A-Za-z0-9/+]{40}/gi,
	},
	// Generic Bearer tokens
	{ name: "bearer-token", regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g },
	// Generic API keys in assignment context
	{
		name: "api-key-assignment",
		regex:
			/(?:api_key|apikey|api-key)\s*[=:]\s*["']?[A-Za-z0-9\-_]{16,}["']?/gi,
	},
	// JWTs
	{
		name: "jwt",
		regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
	},
	// Private keys (PEM headers)
	{ name: "private-key", regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
	// Generic passwords in assignment context
	{
		name: "password-assignment",
		regex: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"',;]{8,}["']?/gi,
	},
	// Database connection strings with credentials
	{
		name: "db-connection-string",
		regex: /(?:postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/gi,
	},
	// GitHub tokens
	{
		name: "github-token",
		regex:
			/ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/g,
	},
	// Slack tokens
	{ name: "slack-token", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
	// Stripe
	{ name: "stripe-key", regex: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g },
	// Generic hex secrets (32+ chars)
	{
		name: "hex-secret",
		regex: /(?:secret|token|key)\s*[=:]\s*["']?[0-9a-f]{32,}["']?/gi,
	},
];

// ── Core scanner ──────────────────────────────────────────────────────────────

/**
 * Scan a string for secret patterns and return redacted version.
 */
export function scanForSecrets(input: string): ScanResult {
	if (!input || typeof input !== "string") {
		return { found: false, count: 0, matches: [], redacted: input };
	}

	const matches: SecretMatch[] = [];
	let redacted = input;

	for (const pattern of SECRET_PATTERNS) {
		// Reset lastIndex for global regex
		pattern.regex.lastIndex = 0;

		let match: RegExpExecArray | null = pattern.regex.exec(input);
		while (match !== null) {
			matches.push({
				pattern: pattern.name,
				value: match[0],
				startIndex: match.index,
				endIndex: match.index + match[0].length,
			});
			match = pattern.regex.exec(input);
		}
	}

	// Sort matches by start position (descending) for safe replacement
	matches.sort((a, b) => b.startIndex - a.startIndex);

	// Deduplicate overlapping matches
	const deduped = deduplicateMatches(matches);

	// Apply replacements in reverse order (right to left) to preserve indices
	for (const m of deduped) {
		redacted =
			redacted.slice(0, m.startIndex) +
			"[REDACTED]" +
			redacted.slice(m.endIndex);
	}

	return {
		found: deduped.length > 0,
		count: deduped.length,
		matches: deduped,
		redacted,
	};
}

/**
 * Quick check: does this string contain any known secret patterns?
 */
export function containsSecret(input: string): boolean {
	if (!input || typeof input !== "string") return false;
	for (const pattern of SECRET_PATTERNS) {
		pattern.regex.lastIndex = 0;
		if (pattern.regex.test(input)) return true;
	}
	return false;
}

/**
 * List all secret patterns by name (for audit/documentation).
 */
export function listPatternNames(): string[] {
	return SECRET_PATTERNS.map((p) => p.name);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deduplicateMatches(sorted: SecretMatch[]): SecretMatch[] {
	if (sorted.length === 0) return [];

	const result: SecretMatch[] = [];
	// Process right-to-left (sorted descending by startIndex).
	// Track the startIndex of the last kept match to detect true overlaps.
	// Two matches overlap when the left match's endIndex > right match's startIndex.
	let lastKeptStart = Number.MAX_SAFE_INTEGER;

	for (const m of sorted) {
		// If this match's end exceeds the start of the already-kept (right-side) match,
		// they overlap — skip the left-side match (right-most wins).
		if (m.endIndex > lastKeptStart) {
			continue;
		}
		result.push(m);
		lastKeptStart = m.startIndex;
	}

	return result;
}
