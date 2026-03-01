"use strict";
/**
 * API fetch helpers for evalgate check.
 * Captures x-request-id from response headers.
 * Sends X-EvalGate-SDK-Version and X-EvalGate-Spec-Version on all requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchQualityLatest = fetchQualityLatest;
exports.fetchRunDetails = fetchRunDetails;
exports.fetchRunExport = fetchRunExport;
exports.publishShare = publishShare;
exports.importRunOnFail = importRunOnFail;
const version_1 = require("../version");
const API_HEADERS = {
    "X-EvalGate-SDK-Version": version_1.SDK_VERSION,
    "X-EvalGate-Spec-Version": version_1.SPEC_VERSION,
};
async function fetchQualityLatest(baseUrl, apiKey, evaluationId, baseline) {
    const headers = { ...API_HEADERS, Authorization: `Bearer ${apiKey}` };
    const url = `${baseUrl.replace(/\/$/, "")}/api/quality?evaluationId=${evaluationId}&action=latest&baseline=${baseline}`;
    try {
        const res = await fetch(url, { headers });
        const requestId = res.headers.get("x-request-id") ?? undefined;
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
    const headers = { ...API_HEADERS, Authorization: `Bearer ${apiKey}` };
    const url = `${baseUrl.replace(/\/$/, "")}/api/evaluations/${evaluationId}/runs/${runId}`;
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
async function fetchRunExport(baseUrl, apiKey, evaluationId, runId) {
    const headers = { ...API_HEADERS, Authorization: `Bearer ${apiKey}` };
    const url = `${baseUrl.replace(/\/$/, "")}/api/evaluations/${evaluationId}/runs/${runId}/export`;
    try {
        const res = await fetch(url, { headers });
        const text = await res.text();
        if (!res.ok)
            return { ok: false, status: res.status, body: text };
        const exportData = JSON.parse(text);
        return { ok: true, exportData };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, status: 0, body: msg };
    }
}
async function publishShare(baseUrl, apiKey, evaluationId, exportData, evaluationRunId, options) {
    const headers = {
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
        if (!res.ok)
            return { ok: false, status: res.status, body: text };
        const data = JSON.parse(text);
        return { ok: true, data };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, status: 0, body: msg };
    }
}
async function importRunOnFail(baseUrl, apiKey, evaluationId, results, options) {
    const headers = {
        ...API_HEADERS,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    };
    if (options.idempotencyKey) {
        headers["Idempotency-Key"] = options.idempotencyKey;
    }
    const body = {
        environment: "dev",
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
        const data = JSON.parse(text);
        return { ok: true, runId: data.runId };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, status: 0, body: msg };
    }
}
