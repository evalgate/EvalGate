"""Tests for OTel exporter (T6)."""

from __future__ import annotations

from evalgate_sdk.otel import (
    OTelAttribute,
    OTelExporter,
    OTelExporterOptions,
    OTelExportPayload,
    OTelSpan,
    create_otel_exporter,
)


class TestOTelAttribute:
    def test_string_value(self) -> None:
        attr = OTelAttribute(key="k", value="v")
        d = attr.to_dict()
        assert d == {"key": "k", "value": {"stringValue": "v"}}

    def test_int_value(self) -> None:
        attr = OTelAttribute(key="k", value=42)
        d = attr.to_dict()
        assert d == {"key": "k", "value": {"intValue": "42"}}

    def test_float_value(self) -> None:
        attr = OTelAttribute(key="k", value=3.14)
        d = attr.to_dict()
        assert d == {"key": "k", "value": {"doubleValue": 3.14}}

    def test_bool_value(self) -> None:
        attr = OTelAttribute(key="k", value=True)
        d = attr.to_dict()
        assert d == {"key": "k", "value": {"boolValue": True}}


class TestOTelSpan:
    def test_to_dict(self) -> None:
        span = OTelSpan(
            trace_id="a" * 32,
            span_id="b" * 16,
            name="test-span",
            start_time_unix_nano=1000,
            end_time_unix_nano=2000,
        )
        d = span.to_dict()
        assert d["name"] == "test-span"
        assert d["traceId"] == "a" * 32
        assert "parentSpanId" not in d

    def test_to_dict_with_parent(self) -> None:
        span = OTelSpan(
            trace_id="a" * 32,
            span_id="b" * 16,
            name="child",
            start_time_unix_nano=1000,
            end_time_unix_nano=2000,
            parent_span_id="c" * 16,
        )
        d = span.to_dict()
        assert d["parentSpanId"] == "c" * 16


class TestOTelExporter:
    def test_create_exporter(self) -> None:
        exporter = create_otel_exporter()
        assert isinstance(exporter, OTelExporter)

    def test_export_from_tracer(self) -> None:
        class FakeTracer:
            spans = [
                {"name": "llm-call", "start_time": 100, "end_time": 200, "metadata": {"model": "gpt-4o"}},
                {"name": "tool-call", "start_time": 200, "end_time": 300},
            ]

        exporter = create_otel_exporter(OTelExporterOptions(service_name="test-svc"))
        payload = exporter.export_from_tracer(FakeTracer())
        assert isinstance(payload, OTelExportPayload)
        resource_spans = payload.to_dict()["resourceSpans"]
        assert len(resource_spans) == 1
        spans = resource_spans[0]["scopeSpans"][0]["spans"]
        assert len(spans) == 2
        assert spans[0]["name"] == "llm-call"

    def test_export_run_result(self) -> None:
        exporter = create_otel_exporter()
        results = [
            {
                "test_id": "t-1", "test_name": "test-a", 
                "passed": True, "score": 95, "duration_ms": 100
            },
            {
                "test_id": "t-2", "test_name": "test-b", 
                "passed": False, "score": 30, "duration_ms": 200, "error": "fail"
            },
        ]
        payload = exporter.export_run_result("run-1", results)
        d = payload.to_dict()
        spans = d["resourceSpans"][0]["scopeSpans"][0]["spans"]
        assert len(spans) == 3  # 1 root + 2 results
        root = spans[0]
        assert root["name"] == "evalgate.run.run-1"

    def test_payload_structure(self) -> None:
        exporter = create_otel_exporter(OTelExporterOptions(service_name="my-svc"))
        payload = exporter.export_run_result("r-1", [])
        d = payload.to_dict()
        resource = d["resourceSpans"][0]["resource"]
        svc_attr = resource["attributes"][0]
        assert svc_attr["key"] == "service.name"
        assert svc_attr["value"]["stringValue"] == "my-svc"
