"""Tests for the collector module (T2)."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from evalgate_sdk.collector import (
    CollectorFeedbackInput,
    CollectorSpanInput,
    ReportTraceInput,
    ReportTraceOptions,
    ReportTraceResult,
    report_trace,
)


def _make_mock_client(response: dict | None = None) -> AsyncMock:
    client = AsyncMock()
    client._request = AsyncMock(return_value=response or {
        "trace_db_id": 42,
        "span_count": 1,
        "queued_for_analysis": True,
    })
    return client


class TestCollectorSpanInput:
    def test_to_dict_minimal(self) -> None:
        span = CollectorSpanInput(span_id="s-1", name="llm-call")
        d = span.to_dict()
        assert d == {"span_id": "s-1", "name": "llm-call"}

    def test_to_dict_full(self) -> None:
        span = CollectorSpanInput(
            span_id="s-1",
            name="llm-call",
            type="llm",
            model="gpt-4o",
            vendor="openai",
            metrics={"prompt_tokens": 100},
        )
        d = span.to_dict()
        assert d["type"] == "llm"
        assert d["model"] == "gpt-4o"
        assert d["metrics"]["prompt_tokens"] == 100


class TestReportTraceInput:
    def test_to_dict(self) -> None:
        inp = ReportTraceInput(
            trace_id="t-123",
            name="chat",
            spans=[CollectorSpanInput(span_id="s-1", name="llm")],
            status="success",
        )
        d = inp.to_dict()
        assert d["trace_id"] == "t-123"
        assert d["status"] == "success"
        assert len(d["spans"]) == 1

    def test_to_dict_with_feedback(self) -> None:
        inp = ReportTraceInput(
            trace_id="t-1",
            name="chat",
            user_feedback=CollectorFeedbackInput(type="thumbs_down"),
        )
        d = inp.to_dict()
        assert d["user_feedback"]["type"] == "thumbs_down"


@pytest.mark.asyncio
async def test_report_trace_sends() -> None:
    client = _make_mock_client()
    inp = ReportTraceInput(
        trace_id="t-1",
        name="test",
        spans=[CollectorSpanInput(span_id="s-1", name="span")],
    )
    result = await report_trace(client, inp)
    assert isinstance(result, ReportTraceResult)
    assert result.sent is True
    assert result.trace_db_id == 42
    assert result.span_count == 1
    client._request.assert_called_once()


@pytest.mark.asyncio
async def test_report_trace_sampling() -> None:
    """With sample_rate=0, non-error traces should be sampled out."""
    client = _make_mock_client()
    inp = ReportTraceInput(trace_id="t-1", name="test")
    result = await report_trace(client, inp, ReportTraceOptions(sample_rate=0.0))
    assert result.sent is False
    assert result.skip_reason == "sampled_out"
    client._request.assert_not_called()


@pytest.mark.asyncio
async def test_report_trace_error_bypasses_sampling() -> None:
    """Error traces bypass sampling."""
    client = _make_mock_client()
    inp = ReportTraceInput(trace_id="t-1", name="test", status="error")
    result = await report_trace(client, inp, ReportTraceOptions(sample_rate=0.0))
    assert result.sent is True


@pytest.mark.asyncio
async def test_report_trace_thumbs_down_bypasses_sampling() -> None:
    """Thumbs-down feedback bypasses sampling."""
    client = _make_mock_client()
    inp = ReportTraceInput(
        trace_id="t-1",
        name="test",
        user_feedback=CollectorFeedbackInput(type="thumbs_down"),
    )
    result = await report_trace(client, inp, ReportTraceOptions(sample_rate=0.0))
    assert result.sent is True
