"use strict";
/**
 * API fetch helpers for evalai check.
 * Captures x-request-id from response headers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchQualityLatest = fetchQualityLatest;
exports.fetchRunDetails = fetchRunDetails;
exports.importRunOnFail = importRunOnFail;
async function fetchQualityLatest(baseUrl, apiKey, evaluationId, baseline) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const url = `${baseUrl.replace(/\/$/, '')}/api/quality?evaluationId=${evaluationId}&action=latest&baseline=${baseline}`;
    try {
        const res = await fetch(url, { headers });
        const requestId = res.headers.get('x-request-id') ?? undefined;
        const body = await res.text();
        if (!res.ok) {
            return { ok: false, status: res.status, body, requestId };
        }
        const data = JSON.parse(body);
        return { ok: true, data, requestId };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, status: 0, body: msg, requestId: undefined };
    }
}
async function fetchRunDetails(baseUrl, apiKey, evaluationId, runId) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const url = `${baseUrl.replace(/\/$/, '')}/api/evaluations/${evaluationId}/runs/${runId}`;
    try {
        const res = await fetch(url, { headers });
        if (!res.ok)
            return { ok: false };
        const data = (await res.json());
        return { ok: true, data };
    }
    catch {
        return { ok: false };
    }
}
async function importRunOnFail(baseUrl, apiKey, evaluationId, results, options) {
    const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
    if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const body = {
        environment: 'dev',
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
        const data = JSON.parse(text);
        return { ok: true, runId: data.runId };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, status: 0, body: msg };
    }
}
