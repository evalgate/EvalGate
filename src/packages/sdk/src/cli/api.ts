/**
 * API fetch helpers for evalai check.
 * Captures x-request-id from response headers.
 */

export type QualityLatestData = {
  score?: number;
  total?: number | null;
  evidenceLevel?: string | null;
  baselineScore?: number | null;
  regressionDelta?: number | null;
  baselineMissing?: boolean | null;
  breakdown?: { passRate?: number; safety?: number; judge?: number };
  flags?: string[];
  evaluationRunId?: number;
  evaluationId?: number;
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

export async function fetchQualityLatest(
  baseUrl: string,
  apiKey: string,
  evaluationId: string,
  baseline: string
): Promise<
  | { ok: true; data: QualityLatestData; requestId?: string }
  | { ok: false; status: number; body: string; requestId?: string }
> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const url = `${baseUrl.replace(/\/$/, '')}/api/quality?evaluationId=${evaluationId}&action=latest&baseline=${baseline}`;

  try {
    const res = await fetch(url, { headers });
    const requestId = res.headers.get('x-request-id') ?? undefined;
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
  runId: number
): Promise<{ ok: true; data: RunDetailsData } | { ok: false }> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const url = `${baseUrl.replace(/\/$/, '')}/api/evaluations/${evaluationId}/runs/${runId}`;

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
  provider?: 'github' | 'gitlab' | 'circle' | 'unknown';
  repo?: string;
  sha?: string;
  branch?: string;
  pr?: number;
  runUrl?: string;
  actor?: string;
};

export type ImportResult = {
  testCaseId: number;
  status: 'passed' | 'failed';
  output: string;
  latencyMs?: number;
  costUsd?: number;
  assertionsJson?: Record<string, unknown>;
};

export async function importRunOnFail(
  baseUrl: string,
  apiKey: string,
  evaluationId: string,
  results: ImportResult[],
  options: {
    idempotencyKey?: string;
    ci?: CiContext;
    importClientVersion?: string;
  }
): Promise<{ ok: true; runId: number } | { ok: false; status: number; body: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const body = {
    environment: 'dev' as const,
    results,
    importClientVersion: options.importClientVersion ?? 'evalai-cli',
    ci: options.ci,
  };

  const url = `${baseUrl.replace(/\/$/, '')}/api/evaluations/${evaluationId}/runs/import`;

  try {
    const res = await fetch(url, {
      method: 'POST',
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
