"""Tests for runtime DSL enhancements (T3): skip/only, from_dataset, get_filtered_specs."""

from __future__ import annotations

import json
import os
import tempfile

import pytest

from evalgate_sdk.runtime.eval import (
    create_result,
    define_eval,
    define_eval_only,
    define_eval_skip,
    from_dataset,
    get_filtered_specs,
)
from evalgate_sdk.runtime.registry import create_eval_runtime
from evalgate_sdk.runtime.types import (
    EvalContext,
    EvalResult,
    EvalSpec,
    SpecOptions,
    SpecRegistrationError,
)


@pytest.fixture(autouse=True)
def _runtime():
    handle = create_eval_runtime("test-project")
    yield handle
    handle.dispose()


# ── define_eval_skip / define_eval_only ───────────────────────────────


class TestSkipOnly:
    def test_define_eval_skip(self, _runtime) -> None:
        async def my_exec(ctx: EvalContext) -> EvalResult:
            return create_result(passed=True, score=100.0)

        spec = define_eval_skip("skip-test", my_exec)
        assert isinstance(spec, EvalSpec)
        assert spec.mode == "skip"

    def test_define_eval_only(self, _runtime) -> None:
        async def my_exec(ctx: EvalContext) -> EvalResult:
            return create_result(passed=True, score=100.0)

        spec = define_eval_only("only-test", my_exec)
        assert isinstance(spec, EvalSpec)
        assert spec.mode == "only"

    def test_normal_mode_default(self, _runtime) -> None:
        async def my_exec(ctx: EvalContext) -> EvalResult:
            return create_result(passed=True, score=100.0)

        spec = define_eval("normal-test", my_exec)
        assert isinstance(spec, EvalSpec)
        assert spec.mode == "normal"


# ── get_filtered_specs ────────────────────────────────────────────────


class TestGetFilteredSpecs:
    def _make_spec(self, name: str, mode: str = "normal") -> EvalSpec:
        return EvalSpec(id=name, name=name, executor=None, mode=mode)

    def test_no_skip_or_only(self) -> None:
        specs = [self._make_spec("a"), self._make_spec("b")]
        result = get_filtered_specs(specs)
        assert len(result) == 2

    def test_skip_excluded(self) -> None:
        specs = [self._make_spec("a"), self._make_spec("b", "skip"), self._make_spec("c")]
        result = get_filtered_specs(specs)
        assert len(result) == 2
        assert all(s.name != "b" for s in result)

    def test_only_takes_precedence(self) -> None:
        specs = [
            self._make_spec("a"),
            self._make_spec("b", "only"),
            self._make_spec("c", "skip"),
        ]
        result = get_filtered_specs(specs)
        assert len(result) == 1
        assert result[0].name == "b"

    def test_multiple_only(self) -> None:
        specs = [
            self._make_spec("a", "only"),
            self._make_spec("b"),
            self._make_spec("c", "only"),
        ]
        result = get_filtered_specs(specs)
        assert len(result) == 2
        names = {s.name for s in result}
        assert names == {"a", "c"}

    def test_empty_list(self) -> None:
        assert get_filtered_specs([]) == []


# ── from_dataset ──────────────────────────────────────────────────────


class TestFromDataset:
    def test_jsonl(self, _runtime) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write('{"q": "What is 1+1?", "a": "2"}\n')
            f.write('{"q": "What is 2+2?", "a": "4"}\n')
            path = f.name

        try:
            async def executor(ctx: EvalContext) -> EvalResult:
                return create_result(passed=True, score=100.0)

            from_dataset("math", path, executor)
            specs = _runtime.runtime.list()
            dataset_specs = [s for s in specs if s.name.startswith("math")]
            assert len(dataset_specs) == 2
            assert dataset_specs[0].name == "math - row 1"
            assert dataset_specs[1].name == "math - row 2"
        finally:
            os.unlink(path)

    def test_csv(self, _runtime) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("question,answer\n")
            f.write("What is 1+1?,2\n")
            f.write("What is 2+2?,4\n")
            path = f.name

        try:
            async def executor(ctx: EvalContext) -> EvalResult:
                return create_result(passed=True, score=100.0)

            from_dataset("csv-test", path, executor)
            specs = _runtime.runtime.list()
            csv_specs = [s for s in specs if s.name.startswith("csv-test")]
            assert len(csv_specs) == 2
        finally:
            os.unlink(path)

    def test_json_array(self, _runtime) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump([{"x": 1}, {"x": 2}, {"x": 3}], f)
            path = f.name

        try:
            async def executor(ctx: EvalContext) -> EvalResult:
                return create_result(passed=True, score=100.0)

            from_dataset("json-test", path, executor)
            specs = _runtime.runtime.list()
            json_specs = [s for s in specs if s.name.startswith("json-test")]
            assert len(json_specs) == 3
        finally:
            os.unlink(path)

    def test_missing_file_raises(self, _runtime) -> None:
        async def executor(ctx: EvalContext) -> EvalResult:
            return create_result(passed=True, score=100.0)

        with pytest.raises(SpecRegistrationError, match="not found"):
            from_dataset("bad", "/nonexistent/file.jsonl", executor)

    def test_unsupported_format_raises(self, _runtime) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".xml", delete=False) as f:
            f.write("<data/>")
            path = f.name

        try:
            async def executor(ctx: EvalContext) -> EvalResult:
                return create_result(passed=True, score=100.0)

            with pytest.raises(SpecRegistrationError, match="Unsupported"):
                from_dataset("bad", path, executor)
        finally:
            os.unlink(path)

    def test_empty_dataset_raises(self, _runtime) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write("")
            path = f.name

        try:
            async def executor(ctx: EvalContext) -> EvalResult:
                return create_result(passed=True, score=100.0)

            with pytest.raises(SpecRegistrationError, match="empty"):
                from_dataset("empty", path, executor)
        finally:
            os.unlink(path)

    def test_options_propagated(self, _runtime) -> None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write('{"q": "test"}\n')
            path = f.name

        try:
            async def executor(ctx: EvalContext) -> EvalResult:
                return create_result(passed=True, score=100.0)

            opts = SpecOptions(tags=["regression"], timeout_ms=5000)
            from_dataset("opts-test", path, executor, options=opts)
            specs = _runtime.runtime.list()
            ds = [s for s in specs if s.name.startswith("opts-test")]
            assert len(ds) == 1
            assert "regression" in ds[0].options.tags
        finally:
            os.unlink(path)


# ── create_result enhancements ────────────────────────────────────────


class TestCreateResult:
    def test_basic(self) -> None:
        r = create_result(passed=True, score=95.0)
        assert r.passed is True
        assert r.score == 95.0
        assert r.status == "passed"

    def test_output_and_tokens(self) -> None:
        r = create_result(passed=True, score=100.0, output="hello", tokens=42)
        assert r.output == "hello"
        assert r.tokens == 42

    def test_duration_ms(self) -> None:
        r = create_result(passed=True, score=50.0, duration_ms=123.4)
        assert r.duration_ms == 123.4

    def test_score_clamped(self) -> None:
        r = create_result(passed=True, score=150.0)
        assert r.score == 100.0

    def test_score_clamped_negative(self) -> None:
        r = create_result(passed=False, score=-10.0)
        assert r.score == 0.0

    def test_error_status(self) -> None:
        r = create_result(passed=False, error="boom")
        assert r.status == "error"
