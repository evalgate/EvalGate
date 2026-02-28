"""AIEvalClient — async HTTP client for the AI Evaluation Platform API."""

from __future__ import annotations

import builtins
import logging
import os
from typing import Any, TypeVar

import httpx

from evalai_sdk._version import __version__
from evalai_sdk.errors import (
    EvalAIError,
    NetworkError,
    create_error_from_response,
)
from evalai_sdk.types import (
    Annotation,
    AnnotationItem,
    AnnotationTask,
    APIKey,
    APIKeyUsage,
    APIKeyWithSecret,
    ClientConfig,
    CreateAnnotationItemParams,
    CreateAnnotationParams,
    CreateAnnotationTaskParams,
    CreateAPIKeyParams,
    CreateEvaluationParams,
    CreateLLMJudgeConfigParams,
    CreateRunParams,
    CreateSpanParams,
    CreateTestCaseParams,
    CreateTraceParams,
    CreateWebhookParams,
    Evaluation,
    EvaluationRun,
    GetLLMJudgeAlignmentParams,
    GetUsageParams,
    ListAnnotationItemsParams,
    ListAnnotationsParams,
    ListAnnotationTasksParams,
    ListAPIKeysParams,
    ListEvaluationsParams,
    ListLLMJudgeConfigsParams,
    ListLLMJudgeResultsParams,
    ListTracesParams,
    ListWebhookDeliveriesParams,
    ListWebhooksParams,
    LLMJudgeAlignment,
    LLMJudgeConfig,
    LLMJudgeResult,
    Organization,
    OrganizationLimits,
    RunLLMJudgeParams,
    Span,
    TestCase,
    Trace,
    UpdateAPIKeyParams,
    UpdateEvaluationParams,
    UpdateTraceParams,
    UpdateWebhookParams,
    UsageStats,
    UsageSummary,
    Webhook,
    WebhookDelivery,
)

logger = logging.getLogger("evalai_sdk")

T = TypeVar("T")


def _env(name: str) -> str | None:
    return os.environ.get(name)


class _BaseAPI:
    """Shared HTTP helpers for every API sub-module."""

    def __init__(self, client: AIEvalClient) -> None:
        self._c = client

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._c._request("GET", path, params=params)

    async def _post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._c._request("POST", path, json=json)

    async def _patch(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._c._request("PATCH", path, json=json)

    async def _put(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._c._request("PUT", path, json=json)

    async def _delete(self, path: str) -> Any:
        return await self._c._request("DELETE", path)


# ── API sub-modules ──────────────────────────────────────────────────


class TraceAPI(_BaseAPI):
    async def create(self, params: CreateTraceParams) -> Trace:
        data = await self._post("/api/traces", json=params.model_dump(exclude_none=True))
        return Trace.model_validate(data)

    async def list(self, params: ListTracesParams | None = None) -> builtins.list[Trace]:
        q = (params or ListTracesParams()).model_dump(exclude_none=True)
        data = await self._get("/api/traces", params=q)
        items = data if isinstance(data, list) else data.get("data", data.get("traces", []))
        return [Trace.model_validate(t) for t in items]

    async def get(self, trace_id: int) -> Trace:
        data = await self._get(f"/api/traces/{trace_id}")
        return Trace.model_validate(data)

    async def update(self, trace_id: int, params: UpdateTraceParams) -> Trace:
        data = await self._patch(f"/api/traces/{trace_id}", json=params.model_dump(exclude_none=True))
        return Trace.model_validate(data)

    async def delete(self, trace_id: int) -> dict[str, str]:
        return await self._delete(f"/api/traces/{trace_id}")

    async def create_span(self, trace_id: int, params: CreateSpanParams) -> Span:
        data = await self._post(f"/api/traces/{trace_id}/spans", json=params.model_dump(exclude_none=True))
        return Span.model_validate(data)

    async def list_spans(self, trace_id: int) -> builtins.list[Span]:
        data = await self._get(f"/api/traces/{trace_id}/spans")
        items = data if isinstance(data, list) else data.get("data", data.get("spans", []))
        return [Span.model_validate(s) for s in items]


class EvaluationAPI(_BaseAPI):
    async def create(self, params: CreateEvaluationParams) -> Evaluation:
        data = await self._post("/api/evaluations", json=params.model_dump(exclude_none=True))
        return Evaluation.model_validate(data)

    async def get(self, evaluation_id: int) -> Evaluation:
        data = await self._get(f"/api/evaluations/{evaluation_id}")
        return Evaluation.model_validate(data)

    async def list(self, params: ListEvaluationsParams | None = None) -> builtins.list[Evaluation]:
        q = (params or ListEvaluationsParams()).model_dump(exclude_none=True)
        data = await self._get("/api/evaluations", params=q)
        items = data if isinstance(data, list) else data.get("data", data.get("evaluations", []))
        return [Evaluation.model_validate(e) for e in items]

    async def update(self, evaluation_id: int, params: UpdateEvaluationParams) -> Evaluation:
        data = await self._patch(f"/api/evaluations/{evaluation_id}", json=params.model_dump(exclude_none=True))
        return Evaluation.model_validate(data)

    async def delete(self, evaluation_id: int) -> dict[str, str]:
        return await self._delete(f"/api/evaluations/{evaluation_id}")

    async def create_test_case(self, evaluation_id: int, params: CreateTestCaseParams) -> TestCase:
        data = await self._post(
            f"/api/evaluations/{evaluation_id}/test-cases",
            json=params.model_dump(exclude_none=True),
        )
        return TestCase.model_validate(data)

    async def list_test_cases(self, evaluation_id: int) -> builtins.list[TestCase]:
        data = await self._get(f"/api/evaluations/{evaluation_id}/test-cases")
        items = data if isinstance(data, list) else data.get("data", data.get("testCases", []))
        return [TestCase.model_validate(tc) for tc in items]

    async def create_run(self, evaluation_id: int, params: CreateRunParams | None = None) -> EvaluationRun:
        body = (params or CreateRunParams()).model_dump(exclude_none=True)
        data = await self._post(f"/api/evaluations/{evaluation_id}/runs", json=body)
        return EvaluationRun.model_validate(data)

    async def list_runs(self, evaluation_id: int) -> builtins.list[EvaluationRun]:
        data = await self._get(f"/api/evaluations/{evaluation_id}/runs")
        items = data if isinstance(data, list) else data.get("data", data.get("runs", []))
        return [EvaluationRun.model_validate(r) for r in items]

    async def get_run(self, evaluation_id: int, run_id: int) -> EvaluationRun:
        data = await self._get(f"/api/evaluations/{evaluation_id}/runs/{run_id}")
        return EvaluationRun.model_validate(data)


class LLMJudgeAPI(_BaseAPI):
    async def evaluate(self, params: RunLLMJudgeParams) -> dict[str, Any]:
        return await self._post("/api/llm-judge/evaluate", json=params.model_dump(exclude_none=True))

    async def create_config(self, params: CreateLLMJudgeConfigParams) -> LLMJudgeConfig:
        data = await self._post("/api/llm-judge/configs", json=params.model_dump(exclude_none=True))
        return LLMJudgeConfig.model_validate(data)

    async def list_configs(self, params: ListLLMJudgeConfigsParams | None = None) -> list[LLMJudgeConfig]:
        q = (params or ListLLMJudgeConfigsParams()).model_dump(exclude_none=True)
        data = await self._get("/api/llm-judge/configs", params=q)
        items = data if isinstance(data, list) else data.get("data", [])
        return [LLMJudgeConfig.model_validate(c) for c in items]

    async def list_results(self, params: ListLLMJudgeResultsParams | None = None) -> list[LLMJudgeResult]:
        q = (params or ListLLMJudgeResultsParams()).model_dump(exclude_none=True)
        data = await self._get("/api/llm-judge/results", params=q)
        items = data if isinstance(data, list) else data.get("data", [])
        return [LLMJudgeResult.model_validate(r) for r in items]

    async def get_alignment(self, params: GetLLMJudgeAlignmentParams) -> LLMJudgeAlignment:
        data = await self._get(f"/api/llm-judge/configs/{params.config_id}/alignment")
        return LLMJudgeAlignment.model_validate(data)


class AnnotationsAPI(_BaseAPI):
    def __init__(self, client: AIEvalClient) -> None:
        super().__init__(client)
        self.tasks = _AnnotationTasksAPI(client)

    async def create(self, params: CreateAnnotationParams) -> Annotation:
        data = await self._post("/api/annotations", json=params.model_dump(exclude_none=True))
        payload = data.get("annotation", data) if isinstance(data, dict) else data
        return Annotation.model_validate(payload)

    async def list(self, params: ListAnnotationsParams | None = None) -> builtins.list[Annotation]:
        q = (params or ListAnnotationsParams()).model_dump(exclude_none=True)
        data = await self._get("/api/annotations", params=q)
        items = data.get("annotations", []) if isinstance(data, dict) else data
        return [Annotation.model_validate(a) for a in items]


class _AnnotationTasksAPI(_BaseAPI):
    def __init__(self, client: AIEvalClient) -> None:
        super().__init__(client)
        self.items = _AnnotationItemsAPI(client)

    async def create(self, params: CreateAnnotationTaskParams) -> AnnotationTask:
        data = await self._post("/api/annotation-tasks", json=params.model_dump(exclude_none=True))
        return AnnotationTask.model_validate(data)

    async def list(self, params: ListAnnotationTasksParams | None = None) -> builtins.list[AnnotationTask]:
        q = (params or ListAnnotationTasksParams()).model_dump(exclude_none=True)
        data = await self._get("/api/annotation-tasks", params=q)
        items = data if isinstance(data, list) else data.get("data", [])
        return [AnnotationTask.model_validate(t) for t in items]

    async def get(self, task_id: int) -> AnnotationTask:
        data = await self._get(f"/api/annotation-tasks/{task_id}")
        return AnnotationTask.model_validate(data)


class _AnnotationItemsAPI(_BaseAPI):
    async def create(self, task_id: int, params: CreateAnnotationItemParams) -> AnnotationItem:
        data = await self._post(f"/api/annotation-tasks/{task_id}/items", json=params.model_dump(exclude_none=True))
        return AnnotationItem.model_validate(data)

    async def list(
        self,
        task_id: int,
        params: ListAnnotationItemsParams | None = None,
    ) -> builtins.list[AnnotationItem]:
        q = (params or ListAnnotationItemsParams()).model_dump(exclude_none=True)
        data = await self._get(f"/api/annotation-tasks/{task_id}/items", params=q)
        items = data if isinstance(data, list) else data.get("data", [])
        return [AnnotationItem.model_validate(i) for i in items]


class DeveloperAPI(_BaseAPI):
    def __init__(self, client: AIEvalClient) -> None:
        super().__init__(client)
        self.api_keys = _APIKeysAPI(client)
        self.webhooks = _WebhooksAPI(client)

    async def get_usage(self, params: GetUsageParams) -> UsageStats:
        data = await self._get("/api/developer/usage", params=params.model_dump(exclude_none=True))
        return UsageStats.model_validate(data)

    async def get_usage_summary(self, organization_id: int) -> UsageSummary:
        data = await self._get("/api/developer/usage/summary", params={"organizationId": organization_id})
        return UsageSummary.model_validate(data)


class _APIKeysAPI(_BaseAPI):
    async def create(self, params: CreateAPIKeyParams) -> APIKeyWithSecret:
        data = await self._post("/api/developer/api-keys", json=params.model_dump(exclude_none=True))
        return APIKeyWithSecret.model_validate(data)

    async def list(self, params: ListAPIKeysParams | None = None) -> builtins.list[APIKey]:
        q = (params or ListAPIKeysParams()).model_dump(exclude_none=True)
        data = await self._get("/api/developer/api-keys", params=q)
        items = data if isinstance(data, list) else data.get("data", data.get("apiKeys", []))
        return [APIKey.model_validate(k) for k in items]

    async def update(self, key_id: int, params: UpdateAPIKeyParams) -> APIKey:
        data = await self._patch(f"/api/developer/api-keys/{key_id}", json=params.model_dump(exclude_none=True))
        return APIKey.model_validate(data)

    async def revoke(self, key_id: int) -> dict[str, str]:
        return await self._delete(f"/api/developer/api-keys/{key_id}")

    async def get_usage(self, key_id: int) -> APIKeyUsage:
        data = await self._get(f"/api/developer/api-keys/{key_id}/usage")
        return APIKeyUsage.model_validate(data)


class _WebhooksAPI(_BaseAPI):
    async def create(self, params: CreateWebhookParams) -> Webhook:
        data = await self._post("/api/developer/webhooks", json=params.model_dump(exclude_none=True))
        return Webhook.model_validate(data)

    async def list(self, params: ListWebhooksParams | None = None) -> builtins.list[Webhook]:
        q = (params or ListWebhooksParams()).model_dump(exclude_none=True)
        data = await self._get("/api/developer/webhooks", params=q)
        items = data if isinstance(data, list) else data.get("data", [])
        return [Webhook.model_validate(w) for w in items]

    async def get(self, webhook_id: int) -> Webhook:
        data = await self._get(f"/api/developer/webhooks/{webhook_id}")
        return Webhook.model_validate(data)

    async def update(self, webhook_id: int, params: UpdateWebhookParams) -> Webhook:
        data = await self._patch(f"/api/developer/webhooks/{webhook_id}", json=params.model_dump(exclude_none=True))
        return Webhook.model_validate(data)

    async def delete(self, webhook_id: int) -> dict[str, str]:
        return await self._delete(f"/api/developer/webhooks/{webhook_id}")

    async def get_deliveries(
        self, webhook_id: int, params: ListWebhookDeliveriesParams | None = None
    ) -> builtins.list[WebhookDelivery]:
        q = (params or ListWebhookDeliveriesParams()).model_dump(exclude_none=True)
        data = await self._get(f"/api/developer/webhooks/{webhook_id}/deliveries", params=q)
        items = data if isinstance(data, list) else data.get("data", [])
        return [WebhookDelivery.model_validate(d) for d in items]


class OrganizationsAPI(_BaseAPI):
    async def get_current(self) -> Organization:
        data = await self._get("/api/organizations/current")
        return Organization.model_validate(data)


# ── Main client ──────────────────────────────────────────────────────


class AIEvalClient:
    """Async client for the AI Evaluation Platform API.

    Usage::

        client = AIEvalClient(api_key="sk-...")

        # Or zero-config (reads EVALAI_API_KEY env var)
        client = AIEvalClient.init()

        trace = await client.traces.create(CreateTraceParams(name="my-trace"))
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        organization_id: int | None = None,
        timeout: int = 30_000,
        debug: bool = False,
        **kwargs: Any,
    ) -> None:
        self._api_key = api_key or _env("EVALAI_API_KEY") or ""
        self._base_url = (base_url or _env("EVALAI_BASE_URL") or "http://localhost:3000").rstrip("/")
        self._organization_id = organization_id or (int(v) if (v := _env("EVALAI_ORGANIZATION_ID")) else None)
        self._timeout = timeout / 1000
        self._debug = debug
        self._config = ClientConfig(
            api_key=self._api_key,
            base_url=self._base_url,
            organization_id=self._organization_id,
            timeout=timeout,
            debug=debug,
            **kwargs,
        )
        self._http: httpx.AsyncClient | None = None

        # API sub-modules
        self.traces = TraceAPI(self)
        self.evaluations = EvaluationAPI(self)
        self.llm_judge = LLMJudgeAPI(self)
        self.annotations = AnnotationsAPI(self)
        self.developer = DeveloperAPI(self)
        self.organizations = OrganizationsAPI(self)

    @classmethod
    def init(cls, **kwargs: Any) -> AIEvalClient:
        """Zero-config factory — reads EVALAI_API_KEY, EVALAI_BASE_URL, EVALAI_ORGANIZATION_ID."""
        return cls(**kwargs)

    @property
    def organization_id(self) -> int | None:
        return self._organization_id

    # ── HTTP layer ───────────────────────────────────────────────

    def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            headers: dict[str, str] = {
                "User-Agent": f"evalai-python/{__version__}",
                "Content-Type": "application/json",
            }
            if self._api_key:
                headers["Authorization"] = f"Bearer {self._api_key}"
            if self._organization_id is not None:
                headers["X-Organization-Id"] = str(self._organization_id)

            self._http = httpx.AsyncClient(
                base_url=self._base_url,
                headers=headers,
                timeout=httpx.Timeout(self._timeout),
            )
        return self._http

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        max_attempts = self._config.retry.max_attempts
        last_error: Exception | None = None

        for attempt in range(1, max_attempts + 1):
            try:
                http = self._get_http()
                resp = await http.request(method, path, params=params, json=json)

                if self._debug:
                    logger.debug("%s %s → %s", method, path, resp.status_code)

                if resp.status_code >= 400:
                    try:
                        data = resp.json()
                    except Exception:
                        data = resp.text
                    err = create_error_from_response(resp.status_code, data)
                    if err.should_retry() and attempt < max_attempts:
                        wait = (2 ** (attempt - 1)) * 0.5
                        if err.retry_after:
                            wait = err.retry_after
                        logger.warning("Retrying %s %s (attempt %d) in %.1fs", method, path, attempt, wait)
                        import asyncio

                        await asyncio.sleep(wait)
                        last_error = err
                        continue
                    raise err

                if resp.status_code == 204:
                    return {}
                return resp.json()

            except EvalAIError:
                raise
            except httpx.TimeoutException as exc:
                last_error = EvalAIError(str(exc), "TIMEOUT", 408)
                if attempt < max_attempts:
                    import asyncio

                    await asyncio.sleep(2 ** (attempt - 1))
                    continue
                raise last_error from exc
            except httpx.HTTPError as exc:
                last_error = NetworkError(str(exc))
                if attempt < max_attempts:
                    import asyncio

                    await asyncio.sleep(2 ** (attempt - 1))
                    continue
                raise last_error from exc

        raise last_error or NetworkError("Request failed after retries")

    async def get_organization_limits(self) -> OrganizationLimits:
        data = await self._request("GET", "/api/organizations/limits")
        return OrganizationLimits.model_validate(data)

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()

    async def __aenter__(self) -> AIEvalClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
