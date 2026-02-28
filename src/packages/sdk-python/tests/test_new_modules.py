"""Tests for new modules: context, logger, pagination, batch, cache, streaming, regression, snapshot, export, etc."""

import json
from pathlib import Path

import pytest

# ── Context ──────────────────────────────────────────────────────────


class TestContext:
    def test_create_and_read(self):
        from evalai_sdk.context import create_context, get_current_context

        with create_context({"user": "test"}):
            ctx = get_current_context()
            assert ctx is not None
            assert ctx["user"] == "test"
        assert get_current_context() is None

    def test_nested_contexts(self):
        from evalai_sdk.context import create_context, get_current_context

        with create_context({"a": 1}):
            with create_context({"b": 2}):
                ctx = get_current_context()
                assert ctx["a"] == 1
                assert ctx["b"] == 2
            ctx = get_current_context()
            assert ctx["a"] == 1
            assert "b" not in ctx

    @pytest.mark.asyncio
    async def test_async_with_context(self):
        from evalai_sdk.context import get_current_context, with_context

        async def check():
            ctx = get_current_context()
            return ctx["key"]

        result = await with_context({"key": "value"}, check)
        assert result == "value"

    def test_sync_with_context(self):
        from evalai_sdk.context import with_context_sync

        result = with_context_sync({"x": 42}, lambda: 42)
        assert result == 42

    def test_merge_with_context(self):
        from evalai_sdk.context import create_context, merge_with_context

        with create_context({"a": 1}):
            merged = merge_with_context({"b": 2})
            assert merged == {"a": 1, "b": 2}

    def test_clone_and_merge(self):
        from evalai_sdk.context import clone_context, merge_contexts

        a = {"x": [1, 2]}
        cloned = clone_context(a)
        cloned["x"].append(3)
        assert a["x"] == [1, 2]

        merged = merge_contexts({"a": 1}, {"b": 2}, {"a": 3})
        assert merged == {"a": 3, "b": 2}

    def test_validate(self):
        from evalai_sdk.context import validate_context

        validate_context({"ok": "yes"})
        with pytest.raises(ValueError):
            validate_context("not a dict")  # type: ignore


# ── Logger ───────────────────────────────────────────────────────────


class TestLogger:
    def test_create_logger(self):
        from evalai_sdk.logger import create_logger

        log = create_logger(level="debug")
        assert log.is_level_enabled("debug")
        assert log.is_level_enabled("error")

    def test_child_logger(self):
        from evalai_sdk.logger import create_logger

        parent = create_logger(level="info")
        child = parent.child("sub")
        assert child._prefix == "evalai.sub"

    def test_custom_handler(self):
        from evalai_sdk.logger import Logger

        calls = []
        log = Logger(level="info", handler=lambda lvl, msg, data: calls.append((lvl, msg)))
        log.info("hello")
        log.debug("ignored")
        assert len(calls) == 1
        assert calls[0] == ("info", "hello")

    def test_global_logger(self):
        from evalai_sdk.logger import Logger, get_logger, set_logger

        custom = Logger(level="warn")
        set_logger(custom)
        assert get_logger()._level == "warn"
        set_logger(Logger(level="info"))

    def test_request_logger(self):
        from evalai_sdk.logger import Logger, RequestLogger

        calls = []
        log = Logger(level="debug", handler=lambda lvl, msg, data: calls.append(msg))
        rl = RequestLogger(log)
        rl.on_request("GET", "/api/test")
        rl.on_response("GET", "/api/test", 200)
        assert len(calls) == 2


# ── Pagination ───────────────────────────────────────────────────────


class TestPagination:
    def test_encode_decode_cursor(self):
        from evalai_sdk.pagination import decode_cursor, encode_cursor

        data = {"offset": 20, "id": "abc"}
        cursor = encode_cursor(data)
        decoded = decode_cursor(cursor)
        assert decoded == data

    @pytest.mark.asyncio
    async def test_paginated_iterator(self):
        from evalai_sdk.pagination import PaginatedIterator

        pages = [["a", "b"], ["c", "d"], ["e"]]
        call_count = 0

        async def fetch(offset, limit):
            nonlocal call_count
            idx = call_count
            call_count += 1
            if idx < len(pages):
                return {"data": pages[idx], "has_more": idx < len(pages) - 1}
            return {"data": [], "has_more": False}

        it = PaginatedIterator(fetch, limit=2)
        all_items = await it.to_list()
        assert all_items == ["a", "b", "c", "d", "e"]

    @pytest.mark.asyncio
    async def test_auto_paginate(self):
        from evalai_sdk.pagination import auto_paginate

        async def fetch(offset, limit):
            if offset == 0:
                return ["x", "y"]
            return []

        items = [item async for item in auto_paginate(fetch, limit=10)]
        assert items == ["x", "y"]

    def test_pagination_meta(self):
        from evalai_sdk.pagination import create_pagination_meta

        meta = create_pagination_meta(["a", "b"], limit=10, offset=0, total=2)
        assert meta["count"] == 2
        assert meta["has_more"] is False

    def test_parse_params(self):
        from evalai_sdk.pagination import parse_pagination_params

        p = parse_pagination_params({"limit": 500, "offset": 10}, max_limit=100)
        assert p["limit"] == 100
        assert p["offset"] == 10


# ── Cache ────────────────────────────────────────────────────────────


class TestCache:
    def test_set_and_get(self):
        from evalai_sdk.cache import CacheTTL, RequestCache

        cache = RequestCache(max_size=10)
        cache.set("GET", "/api/test", {"data": 1}, CacheTTL.SHORT)
        assert cache.get("GET", "/api/test") == {"data": 1}

    def test_miss(self):
        from evalai_sdk.cache import RequestCache

        cache = RequestCache()
        assert cache.get("GET", "/nope") is None

    def test_invalidate(self):
        from evalai_sdk.cache import RequestCache

        cache = RequestCache()
        cache.set("GET", "/api/x", "val", 300)
        cache.invalidate("GET", "/api/x")
        assert cache.get("GET", "/api/x") is None

    def test_clear(self):
        from evalai_sdk.cache import RequestCache

        cache = RequestCache()
        cache.set("GET", "/a", 1, 60)
        cache.set("GET", "/b", 2, 60)
        assert cache.get_stats()["size"] == 2
        cache.clear()
        assert cache.get_stats()["size"] == 0

    def test_lru_eviction(self):
        from evalai_sdk.cache import RequestCache

        cache = RequestCache(max_size=2)
        cache.set("GET", "/a", 1, 60)
        cache.set("GET", "/b", 2, 60)
        cache.set("GET", "/c", 3, 60)
        assert cache.get("GET", "/a") is None
        assert cache.get("GET", "/c") == 3

    def test_should_cache(self):
        from evalai_sdk.cache import should_cache

        assert should_cache("GET", "/api/traces")
        assert not should_cache("POST", "/api/traces")
        assert not should_cache("GET", "/api/unknown")


# ── Batch ────────────────────────────────────────────────────────────


class TestBatch:
    def test_can_batch(self):
        from evalai_sdk.batch import can_batch

        assert can_batch("POST", "/api/traces")
        assert not can_batch("GET", "/api/traces")
        assert not can_batch("POST", "/api/unknown")

    @pytest.mark.asyncio
    async def test_batch_process(self):
        from evalai_sdk.batch import batch_process

        async def double(x: int) -> int:
            return x * 2

        results = await batch_process([1, 2, 3], double, concurrency=2)
        assert sorted(results) == [2, 4, 6]

    @pytest.mark.asyncio
    async def test_batch_process_continue_on_error(self):
        from evalai_sdk.batch import batch_process

        async def maybe_fail(x: int) -> int:
            if x == 2:
                raise ValueError("boom")
            return x

        results = await batch_process([1, 2, 3], maybe_fail, continue_on_error=True)
        assert results[0] == 1
        assert results[2] == 3


# ── Streaming ────────────────────────────────────────────────────────


class TestStreaming:
    def test_chunk(self):
        from evalai_sdk.streaming import chunk

        assert chunk([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

    @pytest.mark.asyncio
    async def test_batch_read(self):
        from evalai_sdk.streaming import batch_read

        async def fetcher(offset: int, limit: int):
            if offset == 0:
                return [1, 2, 3]
            return []

        items = await batch_read(fetcher, limit=10)
        assert items == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_rate_limiter(self):
        from evalai_sdk.streaming import RateLimiter

        limiter = RateLimiter(requests_per_second=100)

        async def fn():
            return 42

        result = await limiter.throttle(fn)
        assert result == 42

    @pytest.mark.asyncio
    async def test_stream_evaluation(self):
        from evalai_sdk.streaming import stream_evaluation

        async def evaluator(text: str) -> str:
            return f"echo: {text}"

        results = []
        async for r in stream_evaluation(evaluator, ["hello", "world"]):
            results.append(r)

        assert len(results) == 2
        assert all("output" in r for r in results)


# ── Regression ───────────────────────────────────────────────────────


class TestRegression:
    def test_constants(self):
        from evalai_sdk.regression import ARTIFACTS, GATE_CATEGORY, GATE_EXIT

        assert GATE_EXIT.PASS == 0
        assert GATE_EXIT.REGRESSION == 1
        assert GATE_CATEGORY.PASS == "pass"
        assert ".evalai/" in ARTIFACTS.BASELINE

    def test_evaluate_regression_pass(self):
        from evalai_sdk.regression import Baseline, evaluate_regression

        baseline = Baseline(scores={"test-1": 0.9, "test-2": 0.85})
        report = evaluate_regression(baseline, {"test-1": 0.88, "test-2": 0.90})
        assert report.gate_exit == 0

    def test_evaluate_regression_fail(self):
        from evalai_sdk.regression import GATE_EXIT, Baseline, evaluate_regression

        baseline = Baseline(scores={"test-1": 0.9})
        report = evaluate_regression(baseline, {"test-1": 0.5})
        assert report.gate_exit == GATE_EXIT.REGRESSION
        assert report.summary["regressions"] == 1


# ── Snapshot ─────────────────────────────────────────────────────────


class TestSnapshot:
    def test_save_and_load(self, tmp_path):
        from evalai_sdk.snapshot import SnapshotManager

        mgr = SnapshotManager(str(tmp_path))
        mgr.save("test-1", "Hello world")
        loaded = mgr.load("test-1")
        assert loaded is not None
        assert loaded.output == "Hello world"

    def test_compare_match(self, tmp_path):
        from evalai_sdk.snapshot import SnapshotManager

        mgr = SnapshotManager(str(tmp_path))
        mgr.save("test-1", "same output")
        comp = mgr.compare("test-1", "same output")
        assert comp.matches is True
        assert comp.similarity == 1.0

    def test_compare_diff(self, tmp_path):
        from evalai_sdk.snapshot import SnapshotManager

        mgr = SnapshotManager(str(tmp_path))
        mgr.save("test-1", "original")
        comp = mgr.compare("test-1", "modified")
        assert comp.matches is False
        assert len(comp.diff_lines) > 0

    def test_delete(self, tmp_path):
        from evalai_sdk.snapshot import SnapshotManager

        mgr = SnapshotManager(str(tmp_path))
        mgr.save("test-1", "data")
        assert mgr.delete("test-1") is True
        assert mgr.load("test-1") is None

    def test_list_snapshots(self, tmp_path):
        from evalai_sdk.snapshot import SnapshotManager

        mgr = SnapshotManager(str(tmp_path))
        mgr.save("a", "data-a")
        mgr.save("b", "data-b")
        snaps = mgr.list_snapshots()
        assert len(snaps) == 2

    def test_module_functions(self, tmp_path):
        from evalai_sdk.snapshot import compare_with_snapshot, load_snapshot, snapshot

        snapshot("test output", "func-test", directory=str(tmp_path))
        loaded = load_snapshot("func-test", directory=str(tmp_path))
        assert loaded is not None

        comp = compare_with_snapshot("func-test", "test output", directory=str(tmp_path))
        assert comp.matches


# ── Export ───────────────────────────────────────────────────────────


class TestExport:
    def test_export_to_json_file(self, tmp_path):
        from evalai_sdk.export import ExportData, export_to_file

        data = ExportData(
            format="json",
            traces=[{"id": 1, "name": "trace-1"}],
            evaluations=[{"id": 1, "name": "eval-1"}],
        )
        path = str(tmp_path / "export.json")
        export_to_file(data, path)
        raw = json.loads(Path(path).read_text())
        assert len(raw["traces"]) == 1

    def test_export_to_jsonl(self, tmp_path):
        from evalai_sdk.export import ExportData, export_to_file

        data = ExportData(
            format="jsonl",
            traces=[{"id": 1}],
            evaluations=[{"id": 2}],
        )
        path = str(tmp_path / "export.jsonl")
        export_to_file(data, path)
        lines = Path(path).read_text().strip().splitlines()
        assert len(lines) == 2

    def test_import_from_json_file(self, tmp_path):
        from evalai_sdk.export import ExportData, export_to_file, import_from_file

        data = ExportData(format="json", traces=[{"id": 1}])
        path = str(tmp_path / "data.json")
        export_to_file(data, path)
        loaded = import_from_file(path)
        assert len(loaded.traces) == 1

    def test_convert_to_csv(self):
        from evalai_sdk.export import ExportData, convert_to_csv

        data = ExportData(traces=[{"id": 1, "name": "t1"}, {"id": 2, "name": "t2"}])
        csv_text = convert_to_csv(data, "traces")
        assert "id" in csv_text
        assert "t1" in csv_text

    def test_langsmith_import(self):
        from evalai_sdk.export import import_from_langsmith

        ls_data = [
            {"id": "run-1", "name": "chain", "run_type": "chain", "inputs": {"q": "hi"}, "outputs": {"a": "hello"}},
        ]
        data = import_from_langsmith(ls_data)
        assert len(data.traces) == 1
        assert data.traces[0]["metadata"]["source"] == "langsmith"


# ── Runtime ──────────────────────────────────────────────────────────


class TestRuntime:
    def test_create_runtime(self):
        from evalai_sdk.runtime import create_eval_runtime

        handle = create_eval_runtime("/my/project")
        assert handle.runtime.namespace != "default"
        handle.dispose()

    def test_register_and_list(self):
        from evalai_sdk.runtime import create_eval_runtime
        from evalai_sdk.runtime.types import EvalSpec

        handle = create_eval_runtime()
        spec = EvalSpec(id="s1", name="test-spec", executor=lambda ctx: True)
        handle.define_eval(spec)
        assert len(handle.runtime.list()) == 1
        handle.dispose()

    def test_duplicate_registration_fails(self):
        from evalai_sdk.runtime import create_eval_runtime
        from evalai_sdk.runtime.types import EvalSpec, SpecRegistrationError

        handle = create_eval_runtime()
        spec = EvalSpec(id="dup", name="dup", executor=lambda ctx: True)
        handle.define_eval(spec)
        with pytest.raises(SpecRegistrationError):
            handle.define_eval(spec)
        handle.dispose()

    def test_health(self):
        from evalai_sdk.runtime import create_eval_runtime

        handle = create_eval_runtime()
        health = handle.runtime.get_health()
        assert health.status == "healthy"
        handle.dispose()

    def test_snapshot_and_restore(self):
        from evalai_sdk.runtime import create_eval_runtime
        from evalai_sdk.runtime.types import EvalSpec

        handle = create_eval_runtime()
        handle.define_eval(EvalSpec(id="x", name="x", executor=lambda ctx: True))
        snap = handle.snapshot()
        assert len(snap["specs"]) == 1
        handle.dispose()


class TestDefineEval:
    def test_basic_define(self):
        from evalai_sdk.runtime import create_eval_runtime, dispose_active_runtime
        from evalai_sdk.runtime.eval import define_eval

        create_eval_runtime()
        spec = define_eval("my-eval", lambda ctx: True)
        assert spec is not None
        assert spec.name == "my-eval"
        dispose_active_runtime()

    def test_invalid_name_rejected(self):
        from evalai_sdk.runtime import create_eval_runtime, dispose_active_runtime
        from evalai_sdk.runtime.eval import define_eval
        from evalai_sdk.runtime.types import SpecRegistrationError

        create_eval_runtime()
        with pytest.raises(SpecRegistrationError):
            define_eval("invalid name with spaces!", lambda ctx: True)
        dispose_active_runtime()

    def test_create_result(self):
        from evalai_sdk.runtime.eval import create_result

        r = create_result(passed=True, score=0.95)
        assert r.passed
        assert r.score == 0.95
        assert r.status == "passed"

        r2 = create_result(passed=False, error="boom")
        assert not r2.passed
        assert r2.status == "error"


class TestExecutor:
    @pytest.mark.asyncio
    async def test_execute_passing(self):
        from evalai_sdk.runtime.executor import create_local_executor
        from evalai_sdk.runtime.types import EvalContext, EvalSpec

        executor = create_local_executor()
        spec = EvalSpec(id="p", name="pass", executor=lambda ctx: {"passed": True, "score": 1.0})
        result = await executor.execute(spec, EvalContext(input="test"))
        assert result.passed
        assert result.score == 1.0

    @pytest.mark.asyncio
    async def test_execute_async(self):
        from evalai_sdk.runtime.executor import create_local_executor
        from evalai_sdk.runtime.types import EvalContext, EvalSpec

        async def async_eval(ctx):
            return {"passed": True, "score": 0.8}

        executor = create_local_executor()
        spec = EvalSpec(id="a", name="async", executor=async_eval)
        result = await executor.execute(spec, EvalContext())
        assert result.passed

    @pytest.mark.asyncio
    async def test_execute_error(self):
        from evalai_sdk.runtime.executor import create_local_executor
        from evalai_sdk.runtime.types import EvalContext, EvalSpec

        def bad(ctx):
            raise RuntimeError("fail")

        executor = create_local_executor()
        spec = EvalSpec(id="e", name="error", executor=bad)
        result = await executor.execute(spec, EvalContext())
        assert not result.passed
        assert result.status == "error"


# ── Matchers ─────────────────────────────────────────────────────────


class TestMatchers:
    def test_to_pass_gate_true(self):
        from evalai_sdk.matchers import to_pass_gate

        class FakeResult:
            passed = True

        assert to_pass_gate(FakeResult())

    def test_to_pass_gate_false(self):
        from evalai_sdk.matchers import to_pass_gate

        assert not to_pass_gate({"passed": False})

    def test_assert_passes_gate(self):
        from evalai_sdk.matchers import GateAssertionError, assert_passes_gate

        class Ok:
            passed = True

        assert_passes_gate(Ok())

        class Fail:
            passed = False
            score = 0.3
            total = 10
            passed_count = 3

        with pytest.raises(GateAssertionError):
            assert_passes_gate(Fail())
