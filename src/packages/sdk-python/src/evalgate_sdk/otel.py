"""OpenTelemetry exporter for WorkflowTracer spans (T6).

Port of the TypeScript SDK's ``otel.ts``.
Converts workflow tracer data into OTLP-compatible JSON payloads.
"""

from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass, field
from typing import Any

import httpx


def _generate_trace_id() -> str:
    """Generate a 32-hex-char trace ID."""
    return f"{random.getrandbits(128):032x}"


def _generate_span_id() -> str:
    """Generate a 16-hex-char span ID."""
    return f"{random.getrandbits(64):016x}"


def _ms_to_ns(ms: float) -> int:
    """Convert milliseconds to nanoseconds."""
    return int(ms * 1_000_000)


@dataclass
class OTelAttribute:
    key: str
    value: Any

    def to_dict(self) -> dict[str, Any]:
        if isinstance(self.value, bool):
            return {"key": self.key, "value": {"boolValue": self.value}}
        if isinstance(self.value, int):
            return {"key": self.key, "value": {"intValue": str(self.value)}}
        if isinstance(self.value, float):
            return {"key": self.key, "value": {"doubleValue": self.value}}
        return {"key": self.key, "value": {"stringValue": str(self.value)}}


@dataclass
class OTelEvent:
    name: str
    time_unix_nano: int = 0
    attributes: list[OTelAttribute] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "timeUnixNano": str(self.time_unix_nano),
            "attributes": [a.to_dict() for a in self.attributes],
        }


@dataclass
class OTelSpan:
    trace_id: str
    span_id: str
    name: str
    start_time_unix_nano: int
    end_time_unix_nano: int
    parent_span_id: str | None = None
    kind: int = 1  # SPAN_KIND_INTERNAL
    status_code: int = 1  # STATUS_CODE_OK
    status_message: str = ""
    attributes: list[OTelAttribute] = field(default_factory=list)
    events: list[OTelEvent] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "traceId": self.trace_id,
            "spanId": self.span_id,
            "name": self.name,
            "kind": self.kind,
            "startTimeUnixNano": str(self.start_time_unix_nano),
            "endTimeUnixNano": str(self.end_time_unix_nano),
            "status": {"code": self.status_code, "message": self.status_message},
            "attributes": [a.to_dict() for a in self.attributes],
            "events": [e.to_dict() for e in self.events],
        }
        if self.parent_span_id:
            d["parentSpanId"] = self.parent_span_id
        return d


@dataclass
class OTelExportPayload:
    """OTLP JSON export payload."""

    resource_spans: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"resourceSpans": self.resource_spans}


@dataclass
class OTelExporterOptions:
    endpoint: str = ""
    service_name: str = "evalgate-sdk"
    headers: dict[str, str] = field(default_factory=dict)
    timeout_ms: int = 10_000


class OTelExporter:
    """Exports evaluation data as OpenTelemetry spans."""

    def __init__(self, options: OTelExporterOptions | None = None) -> None:
        opts = options or OTelExporterOptions()
        self._endpoint = opts.endpoint or os.environ.get(
            "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"
        )
        self._service_name = opts.service_name
        self._headers = opts.headers
        self._timeout = opts.timeout_ms / 1000.0

    def export_from_tracer(self, tracer: Any) -> OTelExportPayload:
        """Convert a WorkflowTracer into an OTLP payload.

        *tracer* should expose ``.spans`` (list of dicts with name, start_time,
        end_time, metadata, parent_span_id, etc.).
        """
        trace_id = _generate_trace_id()
        spans: list[OTelSpan] = []

        raw_spans = getattr(tracer, "spans", [])
        for raw in raw_spans:
            span_id = _generate_span_id()
            attrs: list[OTelAttribute] = []

            if isinstance(raw, dict):
                name = raw.get("name", "unknown")
                start_ns = _ms_to_ns(raw.get("start_time", 0))
                end_ns = _ms_to_ns(raw.get("end_time", start_ns))
                parent = raw.get("parent_span_id")
                for k, v in raw.get("metadata", {}).items():
                    attrs.append(OTelAttribute(key=f"evalgate.{k}", value=v))
            else:
                name = getattr(raw, "name", "unknown")
                start_ns = _ms_to_ns(getattr(raw, "start_time", 0))
                end_ns = _ms_to_ns(getattr(raw, "end_time", start_ns))
                parent = getattr(raw, "parent_span_id", None)

            attrs.append(OTelAttribute(key="evalgate.service", value=self._service_name))
            spans.append(OTelSpan(
                trace_id=trace_id,
                span_id=span_id,
                name=name,
                start_time_unix_nano=start_ns,
                end_time_unix_nano=end_ns,
                parent_span_id=parent,
                attributes=attrs,
            ))

        return self._build_payload(spans)

    def export_run_result(
        self,
        run_id: str,
        results: list[dict[str, Any]],
        start_time_ms: float | None = None,
        end_time_ms: float | None = None,
    ) -> OTelExportPayload:
        """Convert evaluation run results into an OTLP payload."""
        trace_id = _generate_trace_id()
        now_ms = time.time() * 1000
        root_start = _ms_to_ns(start_time_ms or now_ms)
        root_end = _ms_to_ns(end_time_ms or now_ms)

        root_span_id = _generate_span_id()
        spans: list[OTelSpan] = [
            OTelSpan(
                trace_id=trace_id,
                span_id=root_span_id,
                name=f"evalgate.run.{run_id}",
                start_time_unix_nano=root_start,
                end_time_unix_nano=root_end,
                attributes=[
                    OTelAttribute(key="evalgate.run_id", value=run_id),
                    OTelAttribute(key="evalgate.service", value=self._service_name),
                ],
            )
        ]

        for r in results:
            span_id = _generate_span_id()
            duration_ms = r.get("duration_ms", 0)
            s_start = _ms_to_ns(r.get("start_time_ms", now_ms))
            s_end = s_start + _ms_to_ns(duration_ms)

            status = 1 if r.get("passed") else 2  # OK or ERROR
            attrs = [
                OTelAttribute(key="evalgate.test_id", value=r.get("test_id", "")),
                OTelAttribute(key="evalgate.test_name", value=r.get("test_name", "")),
                OTelAttribute(key="evalgate.score", value=r.get("score", 0)),
                OTelAttribute(key="evalgate.passed", value=r.get("passed", False)),
            ]
            spans.append(OTelSpan(
                trace_id=trace_id,
                span_id=span_id,
                parent_span_id=root_span_id,
                name=f"evalgate.spec.{r.get('test_name', 'unknown')}",
                start_time_unix_nano=s_start,
                end_time_unix_nano=s_end,
                status_code=status,
                status_message=r.get("error", ""),
                attributes=attrs,
            ))

        return self._build_payload(spans)

    def _build_payload(self, spans: list[OTelSpan]) -> OTelExportPayload:
        resource = {
            "resource": {
                "attributes": [
                    OTelAttribute(key="service.name", value=self._service_name).to_dict(),
                ],
            },
            "scopeSpans": [
                {
                    "scope": {"name": "evalgate-sdk"},
                    "spans": [s.to_dict() for s in spans],
                }
            ],
        }
        return OTelExportPayload(resource_spans=[resource])

    async def send(self, payload: OTelExportPayload) -> bool:
        """POST the OTLP payload to the collector endpoint.

        Returns False on connection/timeout errors instead of raising.
        """
        url = f"{self._endpoint.rstrip('/')}/v1/traces"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    url,
                    json=payload.to_dict(),
                    headers={"Content-Type": "application/json", **self._headers},
                )
                return resp.status_code < 400
        except (httpx.ConnectError, httpx.TimeoutException, OSError):
            return False


def create_otel_exporter(options: OTelExporterOptions | None = None) -> OTelExporter:
    """Factory function for OTelExporter."""
    return OTelExporter(options)
