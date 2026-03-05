"""Production trace collector — report traces with client-side sampling.

Port of the TypeScript SDK's ``collector.ts``.

Usage::

    from evalgate_sdk import AIEvalClient
    from evalgate_sdk.collector import report_trace

    client = AIEvalClient(api_key="...")
    result = await report_trace(client, ReportTraceInput(
        trace_id="t-123",
        name="chat-completion",
        spans=[CollectorSpanInput(span_id="s-1", name="llm-call")],
    ))
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class CollectorSpanInput:
    span_id: str
    name: str
    type: Literal["llm", "tool", "agent", "retrieval", "default"] | None = None
    parent_span_id: str | None = None
    input: Any = None
    output: Any = None
    model: str | None = None
    vendor: str | None = None
    params: dict[str, Any] | None = None
    metrics: dict[str, Any] | None = None
    timestamps: dict[str, float] | None = None
    error: dict[str, Any] | None = None
    behavioral: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"span_id": self.span_id, "name": self.name}
        for key in (
            "type", "parent_span_id", "input", "output", "model", "vendor",
            "params", "metrics", "timestamps", "error", "behavioral", "metadata",
        ):
            val = getattr(self, key)
            if val is not None:
                d[key] = val
        return d


@dataclass
class CollectorFeedbackInput:
    type: Literal["thumbs_up", "thumbs_down", "rating", "comment"]
    value: Any = None
    user_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type}
        if self.value is not None:
            d["value"] = self.value
        if self.user_id is not None:
            d["user_id"] = self.user_id
        return d


@dataclass
class ReportTraceInput:
    trace_id: str
    name: str
    spans: list[CollectorSpanInput] = field(default_factory=list)
    status: Literal["pending", "success", "error"] | None = None
    duration_ms: float | None = None
    source: Literal["sdk", "api", "cli"] | None = None
    environment: Literal["production", "staging", "dev"] | None = None
    metadata: dict[str, Any] | None = None
    user_feedback: CollectorFeedbackInput | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "trace_id": self.trace_id,
            "name": self.name,
            "spans": [s.to_dict() for s in self.spans],
        }
        for key in ("status", "duration_ms", "source", "environment", "metadata"):
            val = getattr(self, key)
            if val is not None:
                d[key] = val
        if self.user_feedback is not None:
            d["user_feedback"] = self.user_feedback.to_dict()
        return d


@dataclass
class ReportTraceOptions:
    """Options for ``report_trace``."""
    sample_rate: float = 1.0


@dataclass
class ReportTraceResult:
    sent: bool
    trace_id: str
    trace_db_id: int | None = None
    span_count: int | None = None
    queued_for_analysis: bool | None = None
    skip_reason: str | None = None


async def report_trace(
    client: Any,
    input: ReportTraceInput,
    options: ReportTraceOptions | None = None,
) -> ReportTraceResult:
    """Report a production trace to the collector endpoint.

    Client-side sampling: set ``options.sample_rate`` (0–1).
    Error traces and thumbs-down feedback bypass sampling.
    """
    opts = options or ReportTraceOptions()

    is_error = input.status == "error"
    is_negative_feedback = (
        input.user_feedback is not None and input.user_feedback.type == "thumbs_down"
    )
    bypass_sampling = is_error or is_negative_feedback

    if not bypass_sampling and opts.sample_rate < 1.0 and random.random() >= opts.sample_rate:
        return ReportTraceResult(
            sent=False,
            trace_id=input.trace_id,
            skip_reason="sampled_out",
        )

    try:
        response = await client._request("POST", "/api/collector", json=input.to_dict())
    except Exception as exc:
        return ReportTraceResult(
            sent=False,
            trace_id=input.trace_id,
            skip_reason=f"request_failed: {exc}",
        )

    return ReportTraceResult(
        sent=True,
        trace_id=input.trace_id,
        trace_db_id=response.get("trace_db_id"),
        span_count=response.get("span_count"),
        queued_for_analysis=response.get("queued_for_analysis"),
    )
