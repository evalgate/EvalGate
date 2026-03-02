/**
 * Governance Audit Export — serialise audit trails to JSON, CSV, and Markdown.
 *
 * Provides deterministic, reproducible exports of governance events so
 * compliance teams can pull structured audit logs without DB access.
 *
 * Pure module — no DB or I/O dependencies. Callers supply the entries.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AuditEventType =
	| "judge_enabled"
	| "judge_disabled"
	| "tier_changed"
	| "policy_updated"
	| "run_approved"
	| "run_blocked"
	| "violation_recorded"
	| "override_applied";

export interface AuditEvent {
	/** Unique event ID */
	id: string;
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Event type */
	type: AuditEventType;
	/** Subject of the event (judge ID, run ID, policy ID, etc.) */
	subjectId: string;
	/** Subject type for display */
	subjectType: "judge" | "run" | "policy" | "dataset";
	/** Actor that triggered the event */
	actorId: string;
	/** Human-readable description */
	description: string;
	/** Structured metadata about the change */
	metadata: Record<string, unknown>;
	/** Severity / impact level */
	severity: "info" | "warning" | "critical";
	/** Optional organisation scoping */
	organizationId?: string;
}

export type ExportFormat = "json" | "csv" | "markdown" | "ndjson";

export interface AuditExportOptions {
	format: ExportFormat;
	/** Filter to a specific date range (inclusive) */
	fromTimestamp?: string;
	toTimestamp?: string;
	/** Filter to specific event types */
	eventTypes?: AuditEventType[];
	/** Filter to specific actors */
	actorIds?: string[];
	/** Filter to specific subjects */
	subjectIds?: string[];
	/** Filter to specific severity levels */
	severities?: AuditEvent["severity"][];
	/** Sort order (default: asc) */
	sortOrder?: "asc" | "desc";
	/** Maximum events to include (default: unlimited) */
	limit?: number;
}

export interface AuditExportResult {
	format: ExportFormat;
	/** Serialised content */
	content: string;
	/** Number of events included */
	eventCount: number;
	/** Total events before filtering */
	totalEvents: number;
	/** Export timestamp */
	exportedAt: string;
}

// ── Filtering & sorting ───────────────────────────────────────────────────────

export function filterAuditEvents(
	events: AuditEvent[],
	options: AuditExportOptions,
): AuditEvent[] {
	let filtered = [...events];

	if (options.fromTimestamp) {
		const from = new Date(options.fromTimestamp).getTime();
		filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= from);
	}

	if (options.toTimestamp) {
		const to = new Date(options.toTimestamp).getTime();
		filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= to);
	}

	if (options.eventTypes && options.eventTypes.length > 0) {
		const types = new Set(options.eventTypes);
		filtered = filtered.filter((e) => types.has(e.type));
	}

	if (options.actorIds && options.actorIds.length > 0) {
		const actors = new Set(options.actorIds);
		filtered = filtered.filter((e) => actors.has(e.actorId));
	}

	if (options.subjectIds && options.subjectIds.length > 0) {
		const subjects = new Set(options.subjectIds);
		filtered = filtered.filter((e) => subjects.has(e.subjectId));
	}

	if (options.severities && options.severities.length > 0) {
		const sevs = new Set(options.severities);
		filtered = filtered.filter((e) => sevs.has(e.severity));
	}

	// Sort
	filtered.sort((a, b) => {
		const diff =
			new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		return options.sortOrder === "desc" ? -diff : diff;
	});

	// Limit
	if (options.limit && options.limit > 0) {
		filtered = filtered.slice(0, options.limit);
	}

	return filtered;
}

// ── Serialisers ───────────────────────────────────────────────────────────────

function toJSON(events: AuditEvent[]): string {
	return JSON.stringify(events, null, 2);
}

function toNDJSON(events: AuditEvent[]): string {
	return events.map((e) => JSON.stringify(e)).join("\n");
}

/** Escape a CSV cell value */
function csvEscape(value: unknown): string {
	const str = value === null || value === undefined ? "" : String(value);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

const CSV_HEADERS = [
	"id",
	"timestamp",
	"type",
	"subjectId",
	"subjectType",
	"actorId",
	"severity",
	"description",
];

function toCSV(events: AuditEvent[]): string {
	const header = CSV_HEADERS.join(",");
	const rows = events.map((e) =>
		CSV_HEADERS.map((h) => csvEscape(e[h as keyof AuditEvent])).join(","),
	);
	return [header, ...rows].join("\n");
}

const SEVERITY_EMOJI: Record<AuditEvent["severity"], string> = {
	info: "ℹ️",
	warning: "⚠️",
	critical: "🔴",
};

const EVENT_TYPE_LABEL: Record<AuditEventType, string> = {
	judge_enabled: "Judge Enabled",
	judge_disabled: "Judge Disabled",
	tier_changed: "Tier Changed",
	policy_updated: "Policy Updated",
	run_approved: "Run Approved",
	run_blocked: "Run Blocked",
	violation_recorded: "Violation Recorded",
	override_applied: "Override Applied",
};

function toMarkdown(events: AuditEvent[], exportedAt: string): string {
	const lines: string[] = [
		"# Governance Audit Log",
		"",
		`**Exported:** ${exportedAt}  `,
		`**Events:** ${events.length}`,
		"",
		"---",
		"",
	];

	if (events.length === 0) {
		lines.push("_No events match the specified filters._");
		return lines.join("\n");
	}

	for (const event of events) {
		const emoji = SEVERITY_EMOJI[event.severity];
		const typeLabel = EVENT_TYPE_LABEL[event.type] ?? event.type;
		lines.push(`## ${emoji} ${typeLabel} — \`${event.subjectId}\``);
		lines.push("");
		lines.push(`| Field | Value |`);
		lines.push(`|-------|-------|`);
		lines.push(`| **Timestamp** | ${event.timestamp} |`);
		lines.push(`| **Actor** | \`${event.actorId}\` |`);
		lines.push(
			`| **Subject** | \`${event.subjectId}\` (${event.subjectType}) |`,
		);
		lines.push(`| **Severity** | ${event.severity} |`);
		lines.push(`| **Event ID** | \`${event.id}\` |`);
		lines.push("");
		lines.push(`**Description:** ${event.description}`);
		lines.push("");
		if (Object.keys(event.metadata).length > 0) {
			lines.push("**Metadata:**");
			lines.push("```json");
			lines.push(JSON.stringify(event.metadata, null, 2));
			lines.push("```");
		}
		lines.push("---");
		lines.push("");
	}

	return lines.join("\n");
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Export governance audit events in the specified format.
 */
export function exportAuditLog(
	events: AuditEvent[],
	options: AuditExportOptions,
): AuditExportResult {
	const exportedAt = new Date().toISOString();
	const totalEvents = events.length;
	const filtered = filterAuditEvents(events, options);

	let content: string;
	switch (options.format) {
		case "json":
			content = toJSON(filtered);
			break;
		case "ndjson":
			content = toNDJSON(filtered);
			break;
		case "csv":
			content = toCSV(filtered);
			break;
		case "markdown":
			content = toMarkdown(filtered, exportedAt);
			break;
		default:
			content = toJSON(filtered);
	}

	return {
		format: options.format,
		content,
		eventCount: filtered.length,
		totalEvents,
		exportedAt,
	};
}

// ── Summary helpers ───────────────────────────────────────────────────────────

export interface AuditSummary {
	totalEvents: number;
	criticalCount: number;
	warningCount: number;
	infoCount: number;
	eventTypeCounts: Partial<Record<AuditEventType, number>>;
	actorCounts: Record<string, number>;
	dateRange: { from: string; to: string } | null;
}

/**
 * Compute a summary of audit events without serialising them.
 */
export function summarizeAuditLog(events: AuditEvent[]): AuditSummary {
	if (events.length === 0) {
		return {
			totalEvents: 0,
			criticalCount: 0,
			warningCount: 0,
			infoCount: 0,
			eventTypeCounts: {},
			actorCounts: {},
			dateRange: null,
		};
	}

	const eventTypeCounts: Partial<Record<AuditEventType, number>> = {};
	const actorCounts: Record<string, number> = {};
	let criticalCount = 0;
	let warningCount = 0;
	let infoCount = 0;

	for (const event of events) {
		eventTypeCounts[event.type] = (eventTypeCounts[event.type] ?? 0) + 1;
		actorCounts[event.actorId] = (actorCounts[event.actorId] ?? 0) + 1;
		if (event.severity === "critical") criticalCount++;
		else if (event.severity === "warning") warningCount++;
		else infoCount++;
	}

	const timestamps = events.map((e) => e.timestamp).sort();

	return {
		totalEvents: events.length,
		criticalCount,
		warningCount,
		infoCount,
		eventTypeCounts,
		actorCounts,
		dateRange: {
			from: timestamps[0] ?? "",
			to: timestamps[timestamps.length - 1] ?? "",
		},
	};
}
