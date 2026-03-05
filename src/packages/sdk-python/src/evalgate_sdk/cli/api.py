"""API fetch helpers for evalgate CLI commands.

Captures x-request-id from response headers.
Sends X-EvalGate-SDK-Version and X-EvalGate-Spec-Version on all requests.

Port of ``cli/api.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import httpx

from evalgate_sdk._version import SDK_VERSION, SPEC_VERSION

DEFAULT_TIMEOUT = 30.0

API_HEADERS = {
    "X-EvalGate-SDK-Version": SDK_VERSION,
    "X-EvalGate-Spec-Version": SPEC_VERSION,
}


@dataclass
class QualityLatestData:
    score: float | None = None
    total: int | None = None
    evidence_level: str | None = None
    baseline_score: float | None = None
    regression_delta: float | None = None
    baseline_missing: bool | None = None
    breakdown: dict[str, float] = field(default_factory=dict)
    flags: list[str] = field(default_factory=list)
    evaluation_run_id: int | None = None
    evaluation_id: int | None = None
    avg_latency_ms: float | None = None
    cost_usd: float | None = None
    baseline_cost_usd: float | None = None
    baseline_run_id: int | None = None


@dataclass
class RunDetailsData:
    results: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class FetchOptions:
    api_key: str = ""
    base_url: str = ""
    method: str = "GET"
    body: dict[str, Any] | None = None


@dataclass
class ImportResult:
    test_case_id: int = 0
    status: str = "passed"
    output: str = ""
    latency_ms: float | None = None
    cost_usd: float | None = None
    assertions_json: dict[str, Any] | None = None


@dataclass
class PublishShareResult:
    share_id: str = ""
    share_url: str = ""
    share_scope: str = ""


def _require_api_key(api_key: str) -> str:
    """Validate that the API key is present."""
    if not api_key or not api_key.strip():
        raise ValueError("API key is required but was empty. Set EVALGATE_API_KEY or pass --api-key.")
    return api_key.strip()


async def fetch_api(
    path: str,
    opts: FetchOptions,
) -> dict[str, Any]:
    """Generic authenticated fetch to any API endpoint."""
    key = _require_api_key(opts.api_key)
    headers = {
        **API_HEADERS,
        "Authorization": f"Bearer {key}",
    }
    url = f"{opts.base_url.rstrip('/')}{path}"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        if opts.body:
            headers["Content-Type"] = "application/json"
            resp = await client.request(opts.method, url, headers=headers, json=opts.body)
        else:
            resp = await client.request(opts.method, url, headers=headers)

        if resp.status_code >= 400:
            raise RuntimeError(f"API {resp.status_code}: {resp.text[:200]}")

        return resp.json()


async def fetch_quality_latest(
    base_url: str,
    api_key: str,
    evaluation_id: str,
    baseline: str,
) -> dict[str, Any]:
    """Fetch latest quality data for an evaluation.

    Returns ``{"ok": True, "data": {...}, "request_id": ...}`` on success,
    or ``{"ok": False, "status": ..., "body": ..., "request_id": ...}`` on failure.
    """
    key = _require_api_key(api_key)
    headers = {**API_HEADERS, "Authorization": f"Bearer {key}"}
    url = (
        f"{base_url.rstrip('/')}/api/quality?evaluationId="
        f"{quote(str(evaluation_id), safe='')}&action=latest&baseline="
        f"{quote(str(baseline), safe='')}"
    )

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(url, headers=headers)
            request_id = resp.headers.get("x-request-id")
            body = resp.text

            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "body": body, "request_id": request_id}

            data = resp.json()
            return {"ok": True, "data": data, "request_id": request_id}
    except Exception as exc:
        return {"ok": False, "status": 0, "body": str(exc), "request_id": None}


async def fetch_run_details(
    base_url: str,
    api_key: str,
    evaluation_id: str,
    run_id: int,
) -> dict[str, Any]:
    """Fetch run details for an evaluation run."""
    key = _require_api_key(api_key)
    headers = {**API_HEADERS, "Authorization": f"Bearer {key}"}
    url = f"{base_url.rstrip('/')}/api/evaluations/{quote(str(evaluation_id), safe='')}/runs/{run_id}"

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code >= 400:
                return {"ok": False}
            return {"ok": True, "data": resp.json()}
    except Exception:
        return {"ok": False}


async def fetch_run_export(
    base_url: str,
    api_key: str,
    evaluation_id: str,
    run_id: int,
) -> dict[str, Any]:
    """Fetch run export data."""
    key = _require_api_key(api_key)
    headers = {**API_HEADERS, "Authorization": f"Bearer {key}"}
    url = f"{base_url.rstrip('/')}/api/evaluations/{quote(str(evaluation_id), safe='')}/runs/{run_id}/export"

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.get(url, headers=headers)
            body = resp.text
            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "body": body}
            return {"ok": True, "export_data": resp.json()}
    except Exception as exc:
        return {"ok": False, "status": 0, "body": str(exc)}


async def publish_share(
    base_url: str,
    api_key: str,
    evaluation_id: str,
    export_data: dict[str, Any],
    evaluation_run_id: int,
    expires_in_days: int | None = None,
) -> dict[str, Any]:
    """Publish a shared report."""
    key = _require_api_key(api_key)
    headers = {
        **API_HEADERS,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "exportData": export_data,
        "shareScope": "run",
        "evaluationRunId": evaluation_run_id,
    }
    if expires_in_days is not None:
        body["expiresInDays"] = expires_in_days

    url = f"{base_url.rstrip('/')}/api/evaluations/{quote(str(evaluation_id), safe='')}/publish"

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.post(url, headers=headers, json=body)
            text = resp.text
            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "body": text}
            return {"ok": True, "data": resp.json()}
    except Exception as exc:
        return {"ok": False, "status": 0, "body": str(exc)}


async def import_run_on_fail(
    base_url: str,
    api_key: str,
    evaluation_id: str,
    results: list[dict[str, Any]],
    idempotency_key: str | None = None,
    ci: dict[str, Any] | None = None,
    import_client_version: str | None = None,
    check_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Import run results on failure."""
    key = _require_api_key(api_key)
    headers: dict[str, str] = {
        **API_HEADERS,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    body: dict[str, Any] = {
        "environment": "dev",
        "results": results,
        "importClientVersion": import_client_version or "evalgate-cli",
    }
    if ci:
        body["ci"] = ci
    if check_report:
        body["checkReport"] = check_report

    url = f"{base_url.rstrip('/')}/api/evaluations/{quote(str(evaluation_id), safe='')}/runs/import"

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.post(url, headers=headers, json=body)
            text = resp.text
            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "body": text}
            data = resp.json()
            return {"ok": True, "run_id": data.get("runId")}
    except Exception as exc:
        return {"ok": False, "status": 0, "body": str(exc)}
