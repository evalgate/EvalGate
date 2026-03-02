/**
 * Compat — Spec Ownership + Compatibility Policy enforcement.
 *
 * Policy:
 *   - Server supports last N versions (default N=2, i.e. current and one prior)
 *   - SDK must declare its specVersion on upload
 *   - Breaking changes require new version constant + migration + contract tests
 *   - Server auto-upgrades payloads within the supported window
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** How many prior versions the server accepts beyond the current */
export const COMPAT_WINDOW = 2;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompatRange {
	/** Minimum accepted version (inclusive) */
	min: number;
	/** Maximum accepted version (inclusive, = current) */
	max: number;
}

export type CompatStatus =
	| {
			compatible: true;
			needsUpgrade: boolean;
			fromVersion: number;
			toVersion: number;
	  }
	| {
			compatible: false;
			reason: string;
			code: "TOO_OLD" | "TOO_NEW" | "INVALID";
	  };

// ── Core check ───────────────────────────────────────────────────────────────

/**
 * Check whether a client's specVersion is compatible with the server's current version.
 *
 * @param clientVersion  - The specVersion the client declared
 * @param serverVersion  - The current TRACE_SPEC_VERSION on the server
 * @param windowSize     - How many prior versions are accepted (default: COMPAT_WINDOW)
 */
export function checkCompat(
	clientVersion: number,
	serverVersion: number,
	windowSize = COMPAT_WINDOW,
): CompatStatus {
	if (!Number.isInteger(clientVersion) || clientVersion < 1) {
		return {
			compatible: false,
			reason: `Invalid specVersion: ${clientVersion}`,
			code: "INVALID",
		};
	}

	if (clientVersion > serverVersion) {
		return {
			compatible: false,
			reason: `Client specVersion ${clientVersion} is newer than server (${serverVersion}). Upgrade the server.`,
			code: "TOO_NEW",
		};
	}

	const minSupported = Math.max(1, serverVersion - windowSize + 1);
	if (clientVersion < minSupported) {
		return {
			compatible: false,
			reason: `Client specVersion ${clientVersion} is too old (min supported: ${minSupported}). Upgrade the SDK.`,
			code: "TOO_OLD",
		};
	}

	return {
		compatible: true,
		needsUpgrade: clientVersion < serverVersion,
		fromVersion: clientVersion,
		toVersion: serverVersion,
	};
}

/**
 * Convenience boolean — true if the client version is within the supported range.
 */
export function isCompatible(
	clientVersion: number,
	serverVersion: number,
	windowSize = COMPAT_WINDOW,
): boolean {
	return checkCompat(clientVersion, serverVersion, windowSize).compatible;
}

/**
 * Get the supported version range for a given server version and window.
 */
export function getSupportedRange(
	serverVersion: number,
	windowSize = COMPAT_WINDOW,
): CompatRange {
	return {
		min: Math.max(1, serverVersion - windowSize + 1),
		max: serverVersion,
	};
}

/**
 * Generate a human-readable compatibility matrix string for CI/release notes.
 *
 * Example output:
 *   Server v3 accepts client versions: v2, v3
 */
export function formatCompatMatrix(
	serverVersion: number,
	windowSize = COMPAT_WINDOW,
): string {
	const range = getSupportedRange(serverVersion, windowSize);
	const versions: string[] = [];
	for (let v = range.min; v <= range.max; v++) {
		versions.push(`v${v}`);
	}
	return `Server v${serverVersion} accepts client versions: ${versions.join(", ")}`;
}

/**
 * Produce a set of version fixtures for contract test payloads.
 * Returns all versions in the supported window for a given server version.
 */
export function getContractTestVersions(
	serverVersion: number,
	windowSize = COMPAT_WINDOW,
): number[] {
	const range = getSupportedRange(serverVersion, windowSize);
	const versions: number[] = [];
	for (let v = range.min; v <= range.max; v++) {
		versions.push(v);
	}
	return versions;
}
