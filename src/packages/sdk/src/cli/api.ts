/**
 * API fetch helpers for evalgate check.
 * Captures x-request-id from response headers.
 * Sends X-EvalGate-SDK-Version and X-EvalGate-Spec-Version on all requests.
 */

import { SDK_VERSION, SPEC_VERSION } from "../version";

const API_HEADERS: Record<string, string> = {
	"X-EvalGate-SDK-Version": SDK_VERSION,
	"X-EvalGate-Spec-Version": SPEC_VERSION,
};

export type QualityLatestData = {
	score?: number;
	total?: number | null;
	evidenceLevel?: string | null;
	baselineScore?: number | null;
	regressionDelta?: number | null;
	baselineMissing?: boolean | null;
	breakdown?: { passRate?: number; safety?: number; judge?: number };
	judgeAlignment?: {
		tpr?: number;
		tnr?: number;
		sampleSize?: number;
		rawPassRate?: number;
		correctedPassRate?: number;
		ci95?: { low?: number; high?: number } | null;
		correctionApplied?: boolean;
		correctionSkippedReason?: "judge_too_weak_to_correct";
		ciApplied?: boolean;
		ciSkippedReason?:
			| "judge_too_weak_to_correct"
			| "insufficient_samples_for_ci";
		discriminativePower?: number;
		failureModes?: Record<string, number>;
		totalFailed?: number;
	};
	flags?: string[];
	evaluationRunId?: number;
	evaluationId?: number;
	avgLatencyMs?: number | null;
	costUsd?: number | null;
	baselineCostUsd?: number | null;
	baselineRunId?: number | null;
};

export type RunDetailsData = {
	results?: Array<{
		testCaseId?: number;
		status?: string;
		output?: string;
		durationMs?: number;
		assertionsJson?: Record<string, unknown>;
		test_cases?: { name?: string; input?: string; expectedOutput?: string };
	}>;
};

// ── Generic fetch helper for CLI commands ────────────────────────────────────

export interface FetchOptions {
	apiKey: string;
	baseUrl: string;
	method?: string;
	body?: Record<string, unknown>;
}

/**
 * Generic authenticated fetch to any API endpoint.
 * Used by promote, replay, and doctor CLI commands.
 */
export async function fetchAPI(
	path: string,
	opts: FetchOptions,
): Promise<Record<string, unknown>> {
	const headers: Record<string, string> = {
		...API_HEADERS,
		Authorization: `Bearer ${opts.apiKey}`,
	};
	const init: RequestInit = { method: opts.method ?? "GET", headers };

	if (opts.body) {
		headers["Content-Type"] = "application/json";
		init.body = JSON.stringify(opts.body);
	}

	const url = `${opts.baseUrl.replace(/\/$/, "")}${path}`;
	const res = await fetch(url, init);
	const text = await res.text();

	if (!res.ok) {
		throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
	}

	return JSON.parse(text) as Record<string, unknown>;
}

export async function fetchQualityLatest(
	baseUrl: string,
	apiKey: string,
	evaluationId: string,
	baseline: string,
): Promise<
	| { ok: true; data: QualityLatestData; requestId?: string }
	| { ok: false; status: number; body: string; requestId?: string }
> {
	const headers = { ...API_HEADERS, Authorization: `Bearer ${apiKey}` };
	const url = `${baseUrl.replace(/\/$/, "")}/api/quality?evaluationId=${evaluationId}&action=latest&baseline=${baseline}`;

	try {
		const res = await fetch(url, { headers });
		const requestId = res.headers.get("x-request-id") ?? undefined;
		const body = await res.text();

		if (!res.ok) {
			return { ok: false, status: res.status, body, requestId };
		}

		const data = JSON.parse(body) as QualityLatestData;
		return { ok: true, data, requestId };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, status: 0, body: msg, requestId: undefined };
	}
}

export async function fetchRunDetails(
	baseUrl: string,
	apiKey: string,
	evaluationId: string,
	runId: number,
): Promise<{ ok: true; data: RunDetailsData } | { ok: false }> {
	const headers = { ...API_HEADERS, Authorization: `Bearer ${apiKey}` };
	const url = `${baseUrl.replace(/\/$/, "")}/api/evaluations/${evaluationId}/runs/${runId}`;

	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return { ok: false };
		const data = (await res.json()) as RunDetailsData;
		return { ok: true, data };
	} catch {
		return { ok: false };
	}
}

export type CiContext = {
	provider?: "github" | "gitlab" | "circle" | "unknown";
	repo?: string;
	sha?: string;
	branch?: string;
	pr?: number;
	runUrl?: string;
	actor?: string;
};

export type ImportResult = {
	testCaseId: number;
	status: "passed" | "failed";
	output: string;
	latencyMs?: number;
	costUsd?: number;
	assertionsJson?: Record<string, unknown>;
};

export type PublishShareResult = {
	shareId: string;
	shareUrl: string;
	shareScope: string;
};

export async function fetchRunExport(
	baseUrl: string,
	apiKey: string,
	evaluationId: string,
	runId: number,
): Promise<
	| { ok: true; exportData: Record<string, unknown> }
	| { ok: false; status: number; body: string }
> {
	const headers = { ...API_HEADERS, Authorization: `Bearer ${apiKey}` };
	const url = `${baseUrl.replace(/\/$/, "")}/api/evaluations/${evaluationId}/runs/${runId}/export`;

	try {
		const res = await fetch(url, { headers });
		const text = await res.text();
		if (!res.ok) return { ok: false, status: res.status, body: text };
		const exportData = JSON.parse(text) as Record<string, unknown>;
		return { ok: true, exportData };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, status: 0, body: msg };
	}
}

export async function publishShare(
	baseUrl: string,
	apiKey: string,
	evaluationId: string,
	exportData: Record<string, unknown>,
	evaluationRunId: number,
	options?: { expiresInDays?: number },
): Promise<
	| { ok: true; data: PublishShareResult }
	| { ok: false; status: number; body: string }
> {
	const headers: Record<string, string> = {
		...API_HEADERS,
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};
	const body = {
		exportData,
		shareScope: "run",
		evaluationRunId,
		...(options?.expiresInDays != null && {
			expiresInDays: options.expiresInDays,
		}),
	};
	const url = `${baseUrl.replace(/\/$/, "")}/api/evaluations/${evaluationId}/publish`;

	try {
		const res = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});
		const text = await res.text();
		if (!res.ok) return { ok: false, status: res.status, body: text };
		const data = JSON.parse(text) as PublishShareResult;
		return { ok: true, data };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, status: 0, body: msg };
	}
}

export async function importRunOnFail(
	baseUrl: string,
	apiKey: string,
	evaluationId: string,
	results: ImportResult[],
	options: {
		idempotencyKey?: string;
		ci?: CiContext;
		importClientVersion?: string;
		checkReport?: Record<string, unknown>;
	},
): Promise<
	{ ok: true; runId: number } | { ok: false; status: number; body: string }
> {
	const headers: Record<string, string> = {
		...API_HEADERS,
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};
	if (options.idempotencyKey) {
		headers["Idempotency-Key"] = options.idempotencyKey;
	}

	const body = {
		environment: "dev" as const,
		results,
		importClientVersion: options.importClientVersion ?? "evalgate-cli",
		ci: options.ci,
		...(options.checkReport != null && { checkReport: options.checkReport }),
	};

	const url = `${baseUrl.replace(/\/$/, "")}/api/evaluations/${evaluationId}/runs/import`;

	try {
		const res = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});
		const text = await res.text();
		if (!res.ok) {
			return { ok: false, status: res.status, body: text };
		}
		const data = JSON.parse(text) as { runId: number };
		return { ok: true, runId: data.runId };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, status: 0, body: msg };
	}
}
