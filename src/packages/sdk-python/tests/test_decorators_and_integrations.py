"""Tests for decorators, framework integrations, evalai.test alias, and dispose_active_runtime."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

# ── @WithContext decorator ────────────────────────────────────────────


class TestWithContextDecorator:
    def test_sync_function(self):
        from evalai_sdk.context import WithContext, get_current_context

        @WithContext({"service": "TestService", "version": "1.0"})
        def my_func():
            return get_current_context()

        result = my_func()
        assert result is not None
        assert result["service"] == "TestService"
        assert result["version"] == "1.0"

    def test_sync_method(self):
        from evalai_sdk.context import WithContext, get_current_context

        class MyService:
            @WithContext({"component": "parser"})
            def parse(self, text: str):
                ctx = get_current_context()
                return {"text": text, "ctx": ctx}

        svc = MyService()
        result = svc.parse("hello")
        assert result["text"] == "hello"
        assert result["ctx"]["component"] == "parser"

    @pytest.mark.asyncio
    async def test_async_function(self):
        from evalai_sdk.context import WithContext, get_current_context

        @WithContext({"service": "AsyncService"})
        async def my_async_func():
            return get_current_context()

        result = await my_async_func()
        assert result is not None
        assert result["service"] == "AsyncService"

    @pytest.mark.asyncio
    async def test_async_method(self):
        from evalai_sdk.context import WithContext, get_current_context

        class MyAgent:
            @WithContext({"agent": "researcher"})
            async def process(self, query: str):
                ctx = get_current_context()
                return {"query": query, "agent": ctx.get("agent")}

        agent = MyAgent()
        result = await agent.process("test query")
        assert result["query"] == "test query"
        assert result["agent"] == "researcher"

    def test_preserves_function_name(self):
        from evalai_sdk.context import WithContext

        @WithContext({"service": "test"})
        def my_named_function():
            pass

        assert my_named_function.__name__ == "my_named_function"

    def test_context_does_not_leak(self):
        from evalai_sdk.context import WithContext, get_current_context

        @WithContext({"leaked": True})
        def scoped():
            return get_current_context()

        inner = scoped()
        assert inner["leaked"] is True
        assert get_current_context() is None

    def test_nested_decorators(self):
        from evalai_sdk.context import WithContext, get_current_context

        @WithContext({"outer": True})
        def outer():
            ctx_outer = get_current_context()

            @WithContext({"inner": True})
            def inner():
                return get_current_context()

            ctx_inner = inner()
            return ctx_outer, ctx_inner

        outer_ctx, inner_ctx = outer()
        assert outer_ctx["outer"] is True
        assert "inner" not in outer_ctx
        assert inner_ctx["outer"] is True
        assert inner_ctx["inner"] is True


# ── trace_langchain ──────────────────────────────────────────────────


class _MockTracer:
    """Minimal mock of WorkflowTracer for integration tests."""

    def __init__(self):
        self.spans: list[dict[str, Any]] = []
        self.workflows: list[str] = []
        self.ended_spans: list[dict[str, Any]] = []
        self.ended_workflows: list[dict[str, Any]] = []

    async def start_workflow(self, name, definition=None, metadata=None):
        self.workflows.append(name)
        return MagicMock(workflow_id="wf-1", trace_id="tr-1")

    async def end_workflow(self, output=None, status=None):
        self.ended_workflows.append({"output": output, "status": status})

    async def start_agent_span(self, agent_name, input=None, parent_span_id=None):
        span = MagicMock(span_id=f"span-{len(self.spans)}", agent_name=agent_name)
        self.spans.append({"agent_name": agent_name, "input": input})
        return span

    async def end_agent_span(self, span, output=None, error=None):
        self.ended_spans.append({"span": span, "output": output, "error": error})


class TestTraceLangChain:
    @pytest.mark.asyncio
    async def test_ainvoke_traced(self):
        from evalai_sdk.integrations.langchain import trace_langchain

        class FakeExecutor:
            async def ainvoke(self, input, config=None):
                return {"output": f"processed {input}"}

        tracer = _MockTracer()
        traced = trace_langchain(FakeExecutor(), tracer, agent_name="ResearchAgent")
        result = await traced.ainvoke({"query": "hello"})

        assert result["output"] == "processed {'query': 'hello'}"
        assert len(tracer.spans) == 1
        assert tracer.spans[0]["agent_name"] == "ResearchAgent"
        assert len(tracer.ended_spans) == 1
        assert tracer.ended_spans[0]["error"] is None

    @pytest.mark.asyncio
    async def test_ainvoke_error_traced(self):
        from evalai_sdk.integrations.langchain import trace_langchain

        class FailingExecutor:
            async def ainvoke(self, input, config=None):
                raise ValueError("LangChain error")

        tracer = _MockTracer()
        traced = trace_langchain(FailingExecutor(), tracer)

        with pytest.raises(ValueError, match="LangChain error"):
            await traced.ainvoke("test")

        assert len(tracer.ended_spans) == 1
        assert tracer.ended_spans[0]["error"] == "LangChain error"

    @pytest.mark.asyncio
    async def test_passthrough_attributes(self):
        from evalai_sdk.integrations.langchain import trace_langchain

        class Executor:
            custom_attr = "hello"

            async def invoke(self, input, config=None):
                return input

        tracer = _MockTracer()
        traced = trace_langchain(Executor(), tracer)
        assert traced.custom_attr == "hello"


# ── trace_crewai ─────────────────────────────────────────────────────


class TestTraceCrewAI:
    @pytest.mark.asyncio
    async def test_kickoff_traced(self):
        from evalai_sdk.integrations.crewai import trace_crewai

        class FakeCrew:
            async def kickoff(self, input=None):
                return {"report": "done"}

        tracer = _MockTracer()
        traced = trace_crewai(FakeCrew(), tracer, crew_name="ResearchCrew")
        result = await traced.kickoff({"topic": "AI"})

        assert result["report"] == "done"
        assert len(tracer.workflows) == 1
        assert "ResearchCrew" in tracer.workflows[0]
        assert len(tracer.spans) == 1
        assert len(tracer.ended_workflows) == 1

    @pytest.mark.asyncio
    async def test_kickoff_error(self):
        from evalai_sdk.integrations.crewai import trace_crewai

        class FailingCrew:
            async def kickoff(self, input=None):
                raise RuntimeError("crew failed")

        tracer = _MockTracer()
        traced = trace_crewai(FailingCrew(), tracer)

        with pytest.raises(RuntimeError, match="crew failed"):
            await traced.kickoff()

        assert len(tracer.ended_spans) == 1
        assert tracer.ended_spans[0]["error"] == "crew failed"
        assert len(tracer.ended_workflows) == 1


# ── trace_autogen ────────────────────────────────────────────────────


class TestTraceAutoGen:
    @pytest.mark.asyncio
    async def test_initiate_chat_traced(self):
        from evalai_sdk.integrations.autogen import trace_autogen

        class FakeAgent:
            async def initiate_chat(self, recipient, message=""):
                return {"chat_history": [message]}

        tracer = _MockTracer()
        traced = trace_autogen(FakeAgent(), tracer, conversation_name="CodeReview")
        result = await traced.initiate_chat("bot", message="Review this")

        assert result["chat_history"] == ["Review this"]
        assert "CodeReview" in tracer.workflows[0]
        assert len(tracer.spans) == 1
        assert len(tracer.ended_workflows) == 1

    @pytest.mark.asyncio
    async def test_initiate_chat_error(self):
        from evalai_sdk.integrations.autogen import trace_autogen

        class FailingAgent:
            async def initiate_chat(self, *args, **kwargs):
                raise ConnectionError("agent unavailable")

        tracer = _MockTracer()
        traced = trace_autogen(FailingAgent(), tracer)

        with pytest.raises(ConnectionError, match="agent unavailable"):
            await traced.initiate_chat("bot")

        assert tracer.ended_spans[0]["error"] == "agent unavailable"


# ── evalai.test alias ────────────────────────────────────────────────


class TestEvalAIAlias:
    def test_evalai_test_is_define_eval(self):
        from evalai_sdk.runtime.eval import define_eval, evalai

        assert evalai.test is define_eval

    def test_evalai_test_registers_spec(self):
        from evalai_sdk.runtime.eval import create_result, evalai
        from evalai_sdk.runtime.registry import create_eval_runtime, dispose_active_runtime

        handle = create_eval_runtime("/tmp/test-alias")
        try:
            spec = evalai.test("alias-test", lambda ctx: create_result(passed=True, score=100))
            assert spec is not None
            assert spec.name == "alias-test"
            assert handle.runtime.get(spec.id) is not None
        finally:
            dispose_active_runtime()

    def test_evalai_importable_from_package(self):
        from evalai_sdk import evalai

        assert hasattr(evalai, "test")


# ── dispose_active_runtime ───────────────────────────────────────────


class TestDisposeActiveRuntime:
    def test_dispose_clears_runtime(self):
        from evalai_sdk.runtime.registry import (
            create_eval_runtime,
            dispose_active_runtime,
            get_active_runtime,
        )

        create_eval_runtime("/tmp/test-dispose")
        assert get_active_runtime() is not None
        dispose_active_runtime()
        assert get_active_runtime() is None

    def test_dispose_noop_when_none(self):
        from evalai_sdk.runtime.registry import dispose_active_runtime, get_active_runtime

        dispose_active_runtime()
        assert get_active_runtime() is None
        dispose_active_runtime()  # should not raise

    def test_importable_from_package(self):
        from evalai_sdk import dispose_active_runtime

        assert callable(dispose_active_runtime)


# ── Import smoke test ────────────────────────────────────────────────


class TestRunAssertions:
    def test_all_pass(self):
        from evalai_sdk import expect, run_assertions

        results = run_assertions(
            [
                lambda: expect("Hello world").to_contain("Hello"),
                lambda: expect("Hello world").to_contain("world"),
            ]
        )
        assert len(results) == 2
        assert all(r.passed for r in results)

    def test_mixed_results(self):
        from evalai_sdk import expect, run_assertions

        results = run_assertions(
            [
                lambda: expect("Hello").to_contain("Hello"),
                lambda: expect("Hello").to_contain("Goodbye"),
            ]
        )
        assert results[0].passed is True
        assert results[1].passed is False

    def test_exception_caught(self):
        from evalai_sdk import run_assertions

        def bad_assertion():
            raise RuntimeError("assertion exploded")

        results = run_assertions([bad_assertion])
        assert len(results) == 1
        assert results[0].passed is False
        assert "assertion exploded" in results[0].message

    def test_empty_list(self):
        from evalai_sdk import run_assertions

        results = run_assertions([])
        assert results == []


class TestNewExports:
    def test_all_new_symbols_importable(self):
        from evalai_sdk import (
            WithContext,
            dispose_active_runtime,
            evalai,
            trace_autogen,
            trace_crewai,
            trace_langchain,
        )

        assert callable(WithContext)
        assert callable(trace_langchain)
        assert callable(trace_crewai)
        assert callable(trace_autogen)
        assert hasattr(evalai, "test")
        assert callable(dispose_active_runtime)

    def test_full_export_parity(self):
        """Verify every symbol the TS SDK exports is importable from evalai_sdk."""
        from evalai_sdk import (
            SDK_VERSION,
            SPEC_VERSION,
            AIEvalClient,
            LocalExecutor,
            __version__,
            default_local_executor,
            define_eval,
            openai_chat_eval,
            trace_anthropic,
            trace_openai,
        )

        assert __version__ == SDK_VERSION
        assert SPEC_VERSION == "1.9.1"
        assert callable(AIEvalClient)
        assert callable(define_eval)
        assert callable(trace_openai)
        assert callable(trace_anthropic)
        assert callable(openai_chat_eval)
        assert isinstance(default_local_executor, LocalExecutor)
