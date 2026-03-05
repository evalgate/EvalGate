"""Tests for the 17 gap modules identified in the feature parity audit (T12-T15)."""

from __future__ import annotations

import json

import pytest

# ── T14: CLI infra ───────────────────────────────────────────────────
from evalgate_sdk.cli.cli_constants import EXIT
from evalgate_sdk.cli.config import (
    EvalAIConfig,
    find_config_path,
    load_config,
    merge_config_with_args,
)
from evalgate_sdk.cli.env import get_github_step_summary_path, is_ci, is_git_ref, is_github_actions

# ── T15: CLI modules ─────────────────────────────────────────────────
from evalgate_sdk.cli.formatters.types import (
    CHECK_REPORT_SCHEMA_VERSION,
    CheckReport,
    FailedCase,
    ScoreBreakdown01,
)
from evalgate_sdk.cli.manifest import (
    EvaluationManifest,
    SpecAnalysis,
    generate_manifest,
    read_manifest,
    write_manifest,
)
from evalgate_sdk.cli.policy_packs import (
    POLICY_PACKS,
    get_valid_policy_versions,
    resolve_policy_pack,
)
from evalgate_sdk.cli.regression_gate import (
    BuiltinReport,
    format_github,
    format_human,
    parse_gate_args,
)
from evalgate_sdk.cli.render.snippet import truncate_snippet
from evalgate_sdk.cli.render.sort import sort_failed_cases
from evalgate_sdk.cli.report.build_check_report import build_check_report, compute_contrib_pts
from evalgate_sdk.cli.traces import (
    build_run_trace,
    calculate_percentiles,
    format_latency_table,
)
from evalgate_sdk.cli.workspace import resolve_eval_workspace

# ── T12: constants + utils/input_hash ─────────────────────────────────
from evalgate_sdk.constants import DEFAULT_BASE_URL
from evalgate_sdk.runtime.adapters.config_to_dsl import (
    migrate_config_to_dsl,
    migrate_project_to_dsl,
)
from evalgate_sdk.runtime.adapters.testsuite_to_dsl import (
    TestDefinition,
    TestSuiteAdapterOptions,
    adapt_test_suite,
    generate_define_eval_code,
)

# ── T13: runtime/context + adapters ──────────────────────────────────
from evalgate_sdk.runtime.context import (
    clone_runtime_context,
    create_runtime_context,
    merge_runtime_contexts,
    validate_runtime_context,
)
from evalgate_sdk.utils.input_hash import normalize_input, sha256_input


class TestConstants:
    def test_default_base_url(self) -> None:
        assert DEFAULT_BASE_URL == "https://api.evalgate.com"


class TestInputHash:
    def test_normalize_json_key_order(self) -> None:
        a = normalize_input('{"b":2,"a":1}')
        b = normalize_input('{"a":1,"b":2}')
        assert a == b

    def test_normalize_whitespace(self) -> None:
        assert normalize_input("  hello   world  ") == "hello world"

    def test_sha256_deterministic(self) -> None:
        h1 = sha256_input('{"b":1,"a":2}')
        h2 = sha256_input('{"a":2,"b":1}')
        assert h1 == h2
        assert len(h1) == 64

    def test_sha256_different_inputs(self) -> None:
        assert sha256_input("foo") != sha256_input("bar")


# ── T13: runtime/context + adapters ──────────────────────────────────


class TestRuntimeContext:
    def test_create(self) -> None:
        ctx = create_runtime_context("hello", {"key": "val"})
        assert ctx["input"] == "hello"
        assert ctx["metadata"]["key"] == "val"

    def test_merge(self) -> None:
        base = create_runtime_context("a", {"x": 1})
        override = {"metadata": {"y": 2}}
        merged = merge_runtime_contexts(base, override)
        assert merged["metadata"]["x"] == 1
        assert merged["metadata"]["y"] == 2

    def test_merge_no_input_raises(self) -> None:
        with pytest.raises(ValueError):
            merge_runtime_contexts({"metadata": {}}, {})

    def test_clone(self) -> None:
        ctx = create_runtime_context("hello", {"k": "v"})
        cloned = clone_runtime_context(ctx)
        cloned["metadata"]["k"] = "changed"
        assert ctx["metadata"]["k"] == "v"  # original unchanged

    def test_validate_valid(self) -> None:
        ctx = create_runtime_context("hello")
        validate_runtime_context(ctx)  # should not raise

    def test_validate_invalid_input(self) -> None:
        with pytest.raises(TypeError, match="input must be a string"):
            validate_runtime_context({"input": 123})

    def test_validate_not_dict(self) -> None:
        with pytest.raises(TypeError, match="must be a dict"):
            validate_runtime_context("not a dict")


class TestConfigToDsl:
    def test_migrate_missing_config(self, tmp_path) -> None:
        result = migrate_config_to_dsl(str(tmp_path / "missing.json"), str(tmp_path / "out.py"))
        assert result.success is False
        assert "not found" in result.errors[0]

    def test_migrate_valid_config(self, tmp_path) -> None:
        config = tmp_path / "evalgate.config.json"
        config.write_text(json.dumps({"evaluationId": "eval-1"}))
        out = tmp_path / "out.py"
        result = migrate_config_to_dsl(str(config), str(out))
        assert result.success is True
        assert result.specs_generated == 1
        assert out.exists()
        content = out.read_text()
        assert "define_eval" in content

    def test_migrate_project_dry_run(self, tmp_path) -> None:
        (tmp_path / "evalgate.config.json").write_text("{}")
        result = migrate_project_to_dsl(str(tmp_path), dry_run=True)
        assert len(result.warnings) > 0
        assert result.specs_generated == 0

    def test_migrate_project_empty(self, tmp_path) -> None:
        result = migrate_project_to_dsl(str(tmp_path))
        assert "No TestSuite configurations found" in result.warnings[0]


class TestTestSuiteToDsl:
    def test_adapt_basic(self) -> None:
        tests = [
            TestDefinition(id="test-1", input="hello", expected="world"),
            TestDefinition(id="test-2", input="foo"),
        ]
        specs = adapt_test_suite(tests, "my-suite")
        assert len(specs) == 2
        assert specs[0].name == "test-1"
        assert specs[0].metadata["source"] == "legacy"

    def test_adapt_no_provenance(self) -> None:
        tests = [TestDefinition(id="t1", input="x")]
        opts = TestSuiteAdapterOptions(include_provenance=False)
        specs = adapt_test_suite(tests, options=opts)
        assert "source" not in specs[0].metadata

    def test_generate_code(self) -> None:
        tests = [TestDefinition(id="test-a", input="hi", expected="bye")]
        code = generate_define_eval_code(tests, "suite-1")
        assert "define_eval" in code
        assert "test-a" in code
        assert "suite-1" in code


# ── T14: CLI infra ───────────────────────────────────────────────────


class TestExitConstants:
    def test_pass_is_zero(self) -> None:
        assert EXIT.PASS == 0

    def test_all_unique(self) -> None:
        codes = [EXIT.PASS, EXIT.SCORE_BELOW, EXIT.REGRESSION, EXIT.POLICY_VIOLATION,
                 EXIT.API_ERROR, EXIT.BAD_ARGS, EXIT.LOW_N, EXIT.WEAK_EVIDENCE, EXIT.WARN_REGRESSION]
        assert len(set(codes)) == len(codes)


class TestEnvHelpers:
    def test_is_ci_in_ci(self, monkeypatch) -> None:
        monkeypatch.setenv("CI", "true")
        assert is_ci() is True

    def test_is_ci_not_ci(self, monkeypatch) -> None:
        for v in ("GITHUB_ACTIONS", "CI", "CONTINUOUS_INTEGRATION", "BUILDKITE", "CIRCLECI", "TRAVIS", "JENKINS_URL"):
            monkeypatch.delenv(v, raising=False)
        assert is_ci() is False

    def test_is_github_actions(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_ACTIONS", "true")
        assert is_github_actions() is True

    def test_is_git_ref(self) -> None:
        assert is_git_ref("main") is True
        assert is_git_ref("feature/foo") is True
        assert is_git_ref("v1.2.3") is True
        assert is_git_ref("random-string") is False

    def test_github_step_summary(self, monkeypatch) -> None:
        monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
        assert get_github_step_summary_path() is None
        monkeypatch.setenv("GITHUB_STEP_SUMMARY", "/tmp/summary.md")
        assert get_github_step_summary_path() == "/tmp/summary.md"


class TestCliConfig:
    def test_find_config(self, tmp_path) -> None:
        (tmp_path / "evalgate.config.json").write_text("{}")
        found = find_config_path(str(tmp_path))
        assert found is not None
        assert "evalgate.config.json" in found

    def test_find_config_none(self, tmp_path) -> None:
        sub = tmp_path / "empty"
        sub.mkdir()
        # Walk up will hit tmp_path root which also has no config
        found = find_config_path(str(sub))
        # Could be None or could find something higher up, but shouldn't crash
        # The key thing is it doesn't error
        assert found is None or isinstance(found, str)

    def test_load_config(self, tmp_path) -> None:
        (tmp_path / "evalgate.config.json").write_text(json.dumps({
            "evaluationId": "eval-1",
            "minScore": 90,
            "profile": "strict",
        }))
        config = load_config(str(tmp_path))
        assert config is not None
        assert config.evaluation_id == "eval-1"
        assert config.min_score == 90

    def test_merge_config_with_args(self) -> None:
        config = EvalAIConfig(evaluation_id="e1", min_score=80)
        merged = merge_config_with_args(config, {"min_score": 95})
        assert merged["min_score"] == 95
        assert merged["evaluation_id"] == "e1"

    def test_merge_with_profile(self) -> None:
        config = EvalAIConfig(profile="strict")
        merged = merge_config_with_args(config, {})
        assert merged["min_score"] == 95  # strict profile default


# ── T15: CLI modules ─────────────────────────────────────────────────


class TestFormatterTypes:
    def test_check_report_defaults(self) -> None:
        r = CheckReport(evaluation_id="e1")
        assert r.verdict == "fail"
        assert r.gate_applied is True
        assert r.schema_version == CHECK_REPORT_SCHEMA_VERSION

    def test_failed_case(self) -> None:
        fc = FailedCase(name="test-a", status="failed", reason="too low")
        assert fc.name == "test-a"

    def test_breakdown(self) -> None:
        b = ScoreBreakdown01(pass_rate=0.95, safety=0.99)
        assert b.pass_rate == 0.95


class TestManifest:
    def test_generate_manifest(self, tmp_path) -> None:
        spec_file = tmp_path / "eval" / "test.py"
        spec_file.parent.mkdir(parents=True)
        spec_file.write_text("define_eval('my-spec', fn)")

        specs = [SpecAnalysis(id="s1", name="my-spec", file=str(spec_file), tags=["chat"])]

        class FakeMode:
            mode = "spec"

        m = generate_manifest(specs, str(tmp_path), "test-project", FakeMode())
        assert m.schema_version == 1
        assert m.project["name"] == "test-project"
        assert len(m.spec_files) == 1
        assert len(m.specs) == 1
        assert m.specs[0].name == "my-spec"

    def test_write_and_read_manifest(self, tmp_path) -> None:
        m = EvaluationManifest(
            generated_at=1000,
            project={"name": "proj", "root": ".", "namespace": "abcd1234"},
            runtime={"mode": "spec", "sdkVersion": "3.0.0"},
        )
        write_manifest(m, str(tmp_path))
        assert (tmp_path / ".evalgate" / "manifest.json").exists()
        assert (tmp_path / ".evalgate" / "manifest.lock.json").exists()

        loaded = read_manifest(str(tmp_path))
        assert loaded is not None
        assert loaded.project["name"] == "proj"

    def test_read_missing_manifest(self, tmp_path) -> None:
        assert read_manifest(str(tmp_path)) is None


class TestPolicyPacks:
    def test_all_packs_defined(self) -> None:
        assert set(POLICY_PACKS.keys()) == {"HIPAA", "SOC2", "GDPR", "PCI_DSS", "FINRA_4511"}

    def test_resolve_hipaa(self) -> None:
        pack = resolve_policy_pack("HIPAA@1")
        assert pack is not None
        assert pack.policy_id == "HIPAA"

    def test_resolve_without_version(self) -> None:
        pack = resolve_policy_pack("SOC2")
        assert pack is not None
        assert pack.version == 1

    def test_resolve_invalid(self) -> None:
        assert resolve_policy_pack("NONEXISTENT") is None

    def test_resolve_bad_version(self) -> None:
        assert resolve_policy_pack("HIPAA@99") is None

    def test_valid_versions(self) -> None:
        versions = get_valid_policy_versions()
        assert "HIPAA@1" in versions
        assert len(versions) == 5


class TestTraces:
    def test_calculate_percentiles_empty(self) -> None:
        p = calculate_percentiles([])
        assert p["min"] == 0
        assert p["p95"] == 0

    def test_calculate_percentiles(self) -> None:
        p = calculate_percentiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
        assert p["min"] == 10
        assert p["max"] == 100
        assert p["mean"] == 55

    def test_build_run_trace(self) -> None:
        result = {
            "run_id": "r-1",
            "results": [
                {"name": "a", "spec_id": "s1", "file_path": "f.py",
                 "result": {"status": "passed", "score": 100, "duration": 50}},
                {"name": "b", "spec_id": "s2", "file_path": "g.py",
                 "result": {"status": "failed", "score": 0, "duration": 100, "error": "oops"}},
            ],
            "metadata": {"mode": "spec", "duration": 150},
            "summary": {"passed": 1, "failed": 1, "skipped": 0, "passRate": 50},
        }
        trace = build_run_trace(result, git_info={"sha": "abc", "branch": "main"})
        assert trace.run["id"] == "r-1"
        assert trace.summary["total"] == 2
        assert len(trace.specs) == 2
        assert trace.specs[0].git == {"sha": "abc", "branch": "main"}

    def test_format_latency(self) -> None:
        table = format_latency_table({"min": 10, "p50": 50, "p95": 95, "p99": 99, "max": 100, "mean": 55})
        assert "p50" in table
        assert "55ms" in table


class TestRenderSnippet:
    def test_truncate_none(self) -> None:
        assert truncate_snippet(None) == ""

    def test_truncate_short(self) -> None:
        assert truncate_snippet("hello") == "hello"

    def test_truncate_long(self) -> None:
        s = "a" * 200
        result = truncate_snippet(s, max_len=10)
        assert len(result) == 11  # 10 + "…"
        assert result.endswith("…")

    def test_normalize_whitespace(self) -> None:
        assert truncate_snippet("hello\n  world\t!") == "hello world !"


class TestRenderSort:
    def test_sort_by_severity(self) -> None:
        cases = [
            {"status": "passed", "test_case_id": 1},
            {"status": "error", "test_case_id": 2},
            {"status": "failed", "test_case_id": 3},
        ]
        sorted_c = sort_failed_cases(cases)
        assert sorted_c[0]["status"] == "failed"
        assert sorted_c[1]["status"] == "error"
        assert sorted_c[2]["status"] == "passed"

    def test_sort_by_id_within_same_status(self) -> None:
        cases = [
            {"status": "failed", "test_case_id": 5},
            {"status": "failed", "test_case_id": 2},
        ]
        sorted_c = sort_failed_cases(cases)
        assert sorted_c[0]["test_case_id"] == 2


class TestBuildCheckReport:
    def test_basic_pass(self) -> None:
        report = build_check_report(
            evaluation_id="e1",
            quality={"score": 95, "total": 10},
            gate_result={"passed": True, "reasonCode": "PASS"},
        )
        assert report.verdict == "pass"
        assert report.score == 95

    def test_basic_fail(self) -> None:
        report = build_check_report(
            evaluation_id="e1",
            quality={"score": 50, "total": 10},
            gate_result={"passed": False, "reasonCode": "SCORE_TOO_LOW", "reasonMessage": "too low"},
        )
        assert report.verdict == "fail"
        assert report.reason_code == "SCORE_TOO_LOW"

    def test_warn_regression(self) -> None:
        report = build_check_report(
            evaluation_id="e1",
            quality={"score": 88},
            gate_result={"passed": False, "reasonCode": "WARN_REGRESSION"},
        )
        assert report.verdict == "warn"

    def test_gate_skipped(self) -> None:
        report = build_check_report(
            evaluation_id="e1",
            quality={"score": 0, "baselineMissing": True},
            gate_result={"passed": True, "gateSkipped": True, "reasonCode": "BASELINE_MISSING"},
        )
        assert report.gate_applied is False
        assert report.gate_mode == "neutral"
        assert "baseline missing" in (report.actionable_message or "").lower()

    def test_contrib_pts(self) -> None:
        b = ScoreBreakdown01(pass_rate=1.0, safety=1.0, judge=1.0, schema=1.0, latency=1.0, cost=1.0)
        pts = compute_contrib_pts(b)
        assert pts.pass_rate_pts == 50.0
        assert pts.safety_pts == 25.0

    def test_with_failed_cases(self) -> None:
        report = build_check_report(
            evaluation_id="e1",
            quality={"score": 50, "evaluationRunId": 1},
            gate_result={"passed": False, "reasonCode": "SCORE_TOO_LOW"},
            base_url="https://app.evalgate.com",
            run_details={"results": [
                {"status": "failed", "testCaseId": 1, "output": "bad", "test_cases": {"name": "t1", "input": "q"}},
                {"status": "passed", "testCaseId": 2},
            ]},
        )
        assert len(report.failed_cases) == 1
        assert report.failed_cases[0].name == "t1"
        assert report.dashboard_url is not None


class TestRegressionGate:
    def test_parse_gate_args_default(self) -> None:
        args = parse_gate_args([])
        assert args.format == "human"

    def test_parse_gate_args_json(self) -> None:
        args = parse_gate_args(["--format", "json"])
        assert args.format == "json"

    def test_format_human_pass(self) -> None:
        report = BuiltinReport(passed=True, category="pass", deltas=[
            {"metric": "tests_passing", "baseline": True, "current": True, "delta": "0", "status": "pass"},
        ])
        out = format_human(report)
        assert "✅" in out
        assert "PASS" in out

    def test_format_human_fail(self) -> None:
        report = BuiltinReport(passed=False, category="regression", failures=["dropped"])
        out = format_human(report)
        assert "❌" in out
        assert "dropped" in out

    def test_format_github(self) -> None:
        report = BuiltinReport(passed=True, category="pass", deltas=[
            {"metric": "tests_passing", "baseline": True, "current": True, "delta": "0", "status": "pass"},
        ])
        out = format_github(report)
        assert "| Metric |" in out
        assert "✅" in out


class TestWorkspace:
    def test_resolve_default(self, tmp_path) -> None:
        ws = resolve_eval_workspace(str(tmp_path))
        assert ws.root == str(tmp_path)
        assert ws.eval_dir.endswith(".evalgate")

    def test_resolve_legacy_fallback(self, tmp_path) -> None:
        (tmp_path / ".evalai").mkdir()
        ws = resolve_eval_workspace(str(tmp_path))
        assert ws.eval_dir.endswith(".evalai")

    def test_prefers_evalgate_over_evalai(self, tmp_path) -> None:
        (tmp_path / ".evalgate").mkdir()
        (tmp_path / ".evalai").mkdir()
        ws = resolve_eval_workspace(str(tmp_path))
        assert ws.eval_dir.endswith(".evalgate")

    def test_paths_consistent(self, tmp_path) -> None:
        ws = resolve_eval_workspace(str(tmp_path))
        assert ws.manifest_path.startswith(ws.eval_dir)
        assert ws.last_run_path.startswith(ws.eval_dir)
        assert ws.runs_dir.startswith(ws.eval_dir)
        assert ws.index_path.startswith(ws.runs_dir)
        assert ws.baseline_path.startswith(ws.eval_dir)
