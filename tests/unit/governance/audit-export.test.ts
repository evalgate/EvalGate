import { describe, expect, it } from "vitest";
import {
	type AuditEvent,
	type AuditExportOptions,
	exportAuditLog,
	filterAuditEvents,
	summarizeAuditLog,
} from "@/lib/governance/audit-export";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function event(
	id: string,
	type: AuditEvent["type"],
	severity: AuditEvent["severity"] = "info",
	overrides: Partial<AuditEvent> = {},
): AuditEvent {
	return {
		id,
		timestamp: `2025-01-0${id}T10:00:00.000Z`,
		type,
		subjectId: `subject-${id}`,
		subjectType: "judge",
		actorId: "admin-1",
		description: `Event ${id}: ${type}`,
		metadata: { key: `val-${id}` },
		severity,
		...overrides,
	};
}

const EVENTS: AuditEvent[] = [
	event("1", "judge_enabled", "info"),
	event("2", "tier_changed", "warning", { actorId: "admin-2" }),
	event("3", "run_blocked", "critical", {
		subjectId: "run-abc",
		subjectType: "run",
	}),
	event("4", "policy_updated", "info", { actorId: "admin-2" }),
	event("5", "judge_disabled", "warning"),
	event("6", "violation_recorded", "critical", {
		timestamp: "2025-01-06T10:00:00.000Z",
	}),
];

// ── filterAuditEvents ─────────────────────────────────────────────────────────

describe("filterAuditEvents", () => {
	it("returns all events with no filters", () => {
		const result = filterAuditEvents(EVENTS, { format: "json" });
		expect(result).toHaveLength(EVENTS.length);
	});

	it("filters by event type", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			eventTypes: ["judge_enabled", "judge_disabled"],
		});
		expect(result).toHaveLength(2);
		expect(
			result.every((e) => ["judge_enabled", "judge_disabled"].includes(e.type)),
		).toBe(true);
	});

	it("filters by actorId", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			actorIds: ["admin-2"],
		});
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.actorId === "admin-2")).toBe(true);
	});

	it("filters by subjectId", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			subjectIds: ["run-abc"],
		});
		expect(result).toHaveLength(1);
		expect(result[0]!.subjectId).toBe("run-abc");
	});

	it("filters by severity", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			severities: ["critical"],
		});
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.severity === "critical")).toBe(true);
	});

	it("filters by fromTimestamp (inclusive)", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			fromTimestamp: "2025-01-04T00:00:00.000Z",
		});
		expect(result.length).toBeGreaterThanOrEqual(3);
	});

	it("filters by toTimestamp (inclusive)", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			toTimestamp: "2025-01-02T23:59:59.000Z",
		});
		expect(result.length).toBeLessThanOrEqual(2);
	});

	it("respects limit", () => {
		const result = filterAuditEvents(EVENTS, { format: "json", limit: 2 });
		expect(result).toHaveLength(2);
	});

	it("sorts ascending by default", () => {
		const result = filterAuditEvents(EVENTS, { format: "json" });
		for (let i = 1; i < result.length; i++) {
			expect(new Date(result[i]!.timestamp).getTime()).toBeGreaterThanOrEqual(
				new Date(result[i - 1]!.timestamp).getTime(),
			);
		}
	});

	it("sorts descending when sortOrder=desc", () => {
		const result = filterAuditEvents(EVENTS, {
			format: "json",
			sortOrder: "desc",
		});
		for (let i = 1; i < result.length; i++) {
			expect(new Date(result[i]!.timestamp).getTime()).toBeLessThanOrEqual(
				new Date(result[i - 1]!.timestamp).getTime(),
			);
		}
	});
});

// ── exportAuditLog — JSON ─────────────────────────────────────────────────────

describe("exportAuditLog — JSON", () => {
	const opts: AuditExportOptions = { format: "json" };

	it("returns valid JSON array", () => {
		const result = exportAuditLog(EVENTS, opts);
		expect(() => JSON.parse(result.content)).not.toThrow();
		expect(Array.isArray(JSON.parse(result.content))).toBe(true);
	});

	it("eventCount matches events included", () => {
		const result = exportAuditLog(EVENTS, opts);
		expect(result.eventCount).toBe(EVENTS.length);
		expect(result.totalEvents).toBe(EVENTS.length);
	});

	it("filtered export has correct eventCount vs totalEvents", () => {
		const result = exportAuditLog(EVENTS, {
			format: "json",
			severities: ["critical"],
		});
		expect(result.eventCount).toBe(2);
		expect(result.totalEvents).toBe(EVENTS.length);
	});

	it("preserves all event fields", () => {
		const result = exportAuditLog([EVENTS[0]!], opts);
		const parsed = JSON.parse(result.content)[0];
		expect(parsed.id).toBe(EVENTS[0]!.id);
		expect(parsed.type).toBe(EVENTS[0]!.type);
	});
});

// ── exportAuditLog — NDJSON ───────────────────────────────────────────────────

describe("exportAuditLog — NDJSON", () => {
	it("each line is valid JSON", () => {
		const result = exportAuditLog(EVENTS, { format: "ndjson" });
		const lines = result.content.split("\n").filter(Boolean);
		expect(lines).toHaveLength(EVENTS.length);
		for (const line of lines) {
			expect(() => JSON.parse(line)).not.toThrow();
		}
	});
});

// ── exportAuditLog — CSV ──────────────────────────────────────────────────────

describe("exportAuditLog — CSV", () => {
	it("first line is header row", () => {
		const result = exportAuditLog(EVENTS, { format: "csv" });
		const lines = result.content.split("\n");
		expect(lines[0]).toMatch(/id.*timestamp.*type/i);
	});

	it("has correct number of data rows", () => {
		const result = exportAuditLog(EVENTS, { format: "csv" });
		const lines = result.content.split("\n").filter(Boolean);
		expect(lines).toHaveLength(EVENTS.length + 1); // +1 for header
	});

	it("escapes comma-containing description fields", () => {
		const commEvent: AuditEvent = { ...EVENTS[0]!, description: "A, B, C" };
		const result = exportAuditLog([commEvent], { format: "csv" });
		expect(result.content).toContain('"A, B, C"');
	});
});

// ── exportAuditLog — Markdown ─────────────────────────────────────────────────

describe("exportAuditLog — Markdown", () => {
	it("starts with h1 heading", () => {
		const result = exportAuditLog(EVENTS, { format: "markdown" });
		expect(result.content.trimStart()).toMatch(/^#\s/);
	});

	it("contains event type labels", () => {
		const result = exportAuditLog(EVENTS, { format: "markdown" });
		expect(result.content).toContain("Judge Enabled");
	});

	it("includes critical indicator for critical events", () => {
		const result = exportAuditLog(EVENTS, {
			format: "markdown",
			severities: ["critical"],
		});
		expect(result.content).toContain("🔴");
	});

	it("renders empty state for no events", () => {
		const result = exportAuditLog(EVENTS, {
			format: "markdown",
			severities: ["info"],
			eventTypes: ["run_blocked"],
		});
		expect(result.content).toMatch(/no events/i);
	});

	it("includes metadata block", () => {
		const result = exportAuditLog([EVENTS[0]!], { format: "markdown" });
		expect(result.content).toContain("```json");
	});
});

// ── summarizeAuditLog ─────────────────────────────────────────────────────────

describe("summarizeAuditLog", () => {
	it("counts total events", () => {
		const summary = summarizeAuditLog(EVENTS);
		expect(summary.totalEvents).toBe(EVENTS.length);
	});

	it("counts by severity", () => {
		const summary = summarizeAuditLog(EVENTS);
		expect(summary.criticalCount).toBe(2);
		expect(summary.warningCount).toBe(2);
		expect(summary.infoCount).toBe(2);
	});

	it("counts by event type", () => {
		const summary = summarizeAuditLog(EVENTS);
		expect(summary.eventTypeCounts.judge_enabled).toBe(1);
		expect(summary.eventTypeCounts.tier_changed).toBe(1);
	});

	it("counts by actor", () => {
		const summary = summarizeAuditLog(EVENTS);
		expect(summary.actorCounts["admin-1"]).toBe(4);
		expect(summary.actorCounts["admin-2"]).toBe(2);
	});

	it("provides dateRange with from <= to", () => {
		const summary = summarizeAuditLog(EVENTS);
		expect(summary.dateRange).not.toBeNull();
		// ISO strings sort lexicographically same as chronologically
		expect(summary.dateRange!.from <= summary.dateRange!.to).toBe(true);
	});

	it("returns null dateRange for empty events", () => {
		const summary = summarizeAuditLog([]);
		expect(summary.dateRange).toBeNull();
		expect(summary.totalEvents).toBe(0);
	});
});
