"""Regression tests for parity gap fixes (Gaps 1–7)."""

from __future__ import annotations

import asyncio

from evalgate_sdk.assertions import (
    AssertionResult,
    contains_json,
    contains_keywords,
    has_no_toxicity,
    has_readability_score,
    has_sentiment,
    similar_to,
)

# ── Gap 1: Assertions return AssertionResult ─────────────────────────


class TestAssertionsReturnResult:
    """All key assertions must return AssertionResult, not bool."""

    def test_contains_keywords_returns_result(self) -> None:
        r = contains_keywords("hello world", ["hello"])
        assert isinstance(r, AssertionResult)
        assert r.passed is True
        assert r.assertion_type == "containsKeywords"

    def test_contains_keywords_failure_has_message(self) -> None:
        r = contains_keywords("hello", ["world"])
        assert r.passed is False
        assert "world" in r.message

    def test_has_sentiment_returns_result(self) -> None:
        r = has_sentiment("This is great!", "positive")
        assert isinstance(r, AssertionResult)
        assert r.assertion_type == "hasSentiment"

    def test_similar_to_returns_result(self) -> None:
        r = similar_to("hello world", "hello world")
        assert isinstance(r, AssertionResult)
        assert r.passed is True
        assert r.actual == 1.0

    def test_contains_json_returns_result(self) -> None:
        r = contains_json('data: {"key": 1}')
        assert isinstance(r, AssertionResult)
        assert r.passed is True

    def test_has_readability_score_returns_result(self) -> None:
        r = has_readability_score("The cat sat on the mat.", 0)
        assert isinstance(r, AssertionResult)
        assert r.passed is True

    def test_has_no_toxicity_returns_result(self) -> None:
        r = has_no_toxicity("Have a nice day")
        assert isinstance(r, AssertionResult)
        assert r.passed is True


# ── Gap 2: has_no_toxicity blocklist + word-boundary ─────────────────


class TestToxicityBlocklist:
    """Toxicity detection must catch profanity and use word boundaries."""

    def test_catches_profanity(self) -> None:
        r = has_no_toxicity("fuck this")
        assert r.passed is False
        assert "fuck" in r.actual

    def test_catches_slurs(self) -> None:
        r = has_no_toxicity("you are a bitch")
        assert r.passed is False

    def test_word_boundary_no_false_positive(self) -> None:
        # "class" contains "ass" but should NOT trigger
        r = has_no_toxicity("This is a classic example")
        assert r.passed is True

    def test_word_boundary_catches_exact(self) -> None:
        r = has_no_toxicity("You are an ass")
        assert r.passed is False

    def test_clean_text_passes(self) -> None:
        r = has_no_toxicity("Thank you for helping me with this task")
        assert r.passed is True


# ── Gap 3: define_eval.skip / define_eval.only as methods ────────────


class TestDefineEvalMethodSyntax:
    """define_eval should have .skip and .only methods like TS."""

    def test_skip_exists(self) -> None:
        from evalgate_sdk.runtime.eval import define_eval
        assert callable(define_eval.skip)

    def test_only_exists(self) -> None:
        from evalgate_sdk.runtime.eval import define_eval
        assert callable(define_eval.only)


# ── Gap 4: compute_baseline_checksum / verify_baseline_checksum ──────


class TestBaselineChecksum:
    """Baseline tamper detection must be available."""

    def test_compute_is_deterministic(self) -> None:
        from evalgate_sdk.regression import Baseline, compute_baseline_checksum

        b = Baseline(scores={"t1": 0.95, "t2": 0.80})
        c1 = compute_baseline_checksum(b)
        c2 = compute_baseline_checksum(b)
        assert c1 == c2
        assert len(c1) == 64  # SHA-256 hex

    def test_verify_detects_tamper(self) -> None:
        from evalgate_sdk.regression import (
            Baseline,
            compute_baseline_checksum,
            verify_baseline_checksum,
        )

        b = Baseline(scores={"t1": 0.95})
        checksum = compute_baseline_checksum(b)
        assert verify_baseline_checksum(b, checksum) is True

        # Tamper with scores
        b.scores["t1"] = 0.50
        assert verify_baseline_checksum(b, checksum) is False

    def test_exported_from_barrel(self) -> None:
        import evalgate_sdk
        assert hasattr(evalgate_sdk, "compute_baseline_checksum")
        assert hasattr(evalgate_sdk, "verify_baseline_checksum")


# ── Gap 5: RequestCache removed from barrel ──────────────────────────


class TestRequestCacheRemoved:
    """RequestCache should not be in the public barrel."""

    def test_not_in_all(self) -> None:
        import evalgate_sdk
        assert "RequestCache" not in evalgate_sdk.__all__

    def test_not_importable_from_barrel(self) -> None:
        import evalgate_sdk
        assert not hasattr(evalgate_sdk, "RequestCache")


# ── Gap 6: WorkflowTracer offline mode ───────────────────────────────


class TestWorkflowTracerOffline:
    """WorkflowTracer must accept name and offline kwargs."""

    def test_constructor_accepts_name_and_offline(self) -> None:
        from evalgate_sdk.workflows import WorkflowTracer

        tracer = WorkflowTracer(None, name="test-wf", offline=True)
        assert tracer._name == "test-wf"
        assert tracer._offline is True

    def test_offline_start_workflow_no_api_call(self) -> None:
        from evalgate_sdk.workflows import WorkflowTracer

        tracer = WorkflowTracer(None, name="offline-wf", offline=True)
        ctx = asyncio.get_event_loop().run_until_complete(tracer.start_workflow())
        assert ctx.name == "offline-wf"
        assert ctx.trace_id is None  # no API call made

    def test_create_workflow_tracer_passes_kwargs(self) -> None:
        from evalgate_sdk.workflows import create_workflow_tracer

        tracer = create_workflow_tracer(None, name="test", offline=True)
        assert tracer._offline is True


# ── Gap 7: ValidationError.message property ──────────────────────────


class TestValidationErrorMessage:
    """ValidationError should have a .message property matching TS."""

    def test_message_property(self) -> None:
        from evalgate_sdk.errors import ValidationError

        err = ValidationError("Field 'name' is required")
        assert err.message == "Field 'name' is required"

    def test_message_on_base_class(self) -> None:
        from evalgate_sdk.errors import EvalGateError

        err = EvalGateError("Something went wrong")
        assert err.message == "Something went wrong"


# ── R1: has_valid_code_syntax uses ast.parse for Python ──────────────


class TestCodeSyntaxValidation:
    """Python validation must use ast.parse, not regex keyword matching."""

    def test_valid_python(self) -> None:
        from evalgate_sdk.assertions import has_valid_code_syntax

        assert has_valid_code_syntax("def hello():\n    return 'hi'", "python")

    def test_invalid_python_with_keyword(self) -> None:
        from evalgate_sdk.assertions import has_valid_code_syntax

        # Contains 'def' but is not valid Python syntax
        assert not has_valid_code_syntax("def hello(): SYNTAX ERROR {{{{{", "python")

    def test_plain_text_with_keyword(self) -> None:
        from evalgate_sdk.assertions import has_valid_code_syntax

        # Text containing keyword but not code
        assert not has_valid_code_syntax("not python at all just text with def keyword", "python")

    def test_javascript_structural(self) -> None:
        from evalgate_sdk.assertions import has_valid_code_syntax

        assert has_valid_code_syntax("const x = () => {return 42;}", "javascript")


# ── R2: has_factual_accuracy uses word-overlap not substring ─────────


class TestFactualAccuracy:
    """has_factual_accuracy must not pass contradictory content."""

    def test_matching_fact(self) -> None:
        from evalgate_sdk.assertions import has_factual_accuracy

        assert has_factual_accuracy("Paris is the capital of France", ["Paris is the capital of France"])

    def test_contradictory_fact(self) -> None:
        from evalgate_sdk.assertions import has_factual_accuracy

        # "London is the capital of France" should NOT pass against
        # "Paris is the capital of France" — the key word "Paris" is missing
        assert not has_factual_accuracy(
            "London is the capital of France",
            ["Paris is the capital of France"],
        )


# ── R3: has_sentiment_with_score confidence is not always 1.0 ────────


class TestSentimentConfidenceGradient:
    """Confidence must vary with word-count magnitude, not be flat 1.0."""

    def test_single_word_input_not_max_confidence(self) -> None:
        from evalgate_sdk.assertions import has_sentiment_with_score

        # Exact audit failure case: single word "good" must not return 1.0
        result = has_sentiment_with_score("good", "positive")
        assert result["confidence"] < 1.0, f"Single-word confidence must be < 1.0, got {result['confidence']}"
        assert result["sentiment"] == "positive"

    def test_single_word_not_max_confidence(self) -> None:
        from evalgate_sdk.assertions import has_sentiment_with_score

        # "great" alone in a long sentence should not produce 1.0 confidence
        result = has_sentiment_with_score("The weather today is great but I am not sure about tomorrow", "positive")
        assert result["confidence"] < 1.0

    def test_many_positive_words_higher_confidence(self) -> None:
        from evalgate_sdk.assertions import has_sentiment_with_score

        low = has_sentiment_with_score("This is great and the rest is whatever", "positive")
        high = has_sentiment_with_score("great wonderful excellent fantastic amazing", "positive")
        assert high["confidence"] > low["confidence"]

    def test_neutral_returns_half(self) -> None:
        from evalgate_sdk.assertions import has_sentiment_with_score

        result = has_sentiment_with_score("The sky is blue", "neutral")
        assert result["confidence"] == 0.5


# ── R4: TestSuiteConfig has retry/seed/strict options ────────────────


class TestTestSuiteConfigOptions:
    """TestSuiteConfig must have retries, retryDelayMs, retryJitter, seed, strict, stopOnFailure."""

    def test_all_fields_exist_with_defaults(self) -> None:
        from evalgate_sdk.types import TestSuiteConfig

        cfg = TestSuiteConfig()
        assert cfg.retries == 0
        assert cfg.retry_delay_ms == 1000
        assert cfg.retry_jitter is False
        assert cfg.seed is None
        assert cfg.strict is False
        assert cfg.stop_on_failure is False

    def test_custom_values(self) -> None:
        from evalgate_sdk.types import TestSuiteConfig

        cfg = TestSuiteConfig(
            retries=3, retry_delay_ms=500, retry_jitter=True, 
            seed=42, strict=True, stop_on_failure=True
        )
        assert cfg.retries == 3
        assert cfg.seed == 42
        assert cfg.strict is True


# ── R5: import_data is 2-arg (data, options) ─────────────────────────


class TestImportDataSignature:
    """import_data should accept (data, options) without requiring client as positional."""

    def test_signature_is_two_arg(self) -> None:
        import inspect

        from evalgate_sdk.export import import_data

        sig = inspect.signature(import_data)
        params = list(sig.parameters.keys())
        # First two params should be data and options
        assert params[0] == "data"
        assert params[1] == "options"
        # client should be keyword-only
        assert sig.parameters["client"].kind == inspect.Parameter.KEYWORD_ONLY


# ── R6: Logger.child uses : separator ────────────────────────────────


class TestLoggerSeparator:
    """Logger.child must use ':' separator matching TS SDK."""

    def test_child_uses_colon(self) -> None:
        from evalgate_sdk.logger import Logger

        parent = Logger(prefix="root")
        child = parent.child("sub")
        assert child._prefix == "root:sub"

    def test_nested_children(self) -> None:
        from evalgate_sdk.logger import Logger

        root = Logger(prefix="evalai")
        child = root.child("client").child("http")
        assert child._prefix == "evalai:client:http"


# ── R7: to_have_no_profanity exists on Expectation ──────────────────


class TestExpectNoProfanity:
    """Expectation must have to_have_no_profanity matching TS toHaveNoProfanity."""

    def test_clean_text_passes(self) -> None:
        from evalgate_sdk.assertions import expect

        r = expect("Thank you for your help").to_have_no_profanity()
        assert r.passed is True
        assert r.assertion_type == "noProfanity"

    def test_profane_text_fails(self) -> None:
        from evalgate_sdk.assertions import expect

        r = expect("What the fuck").to_have_no_profanity()
        assert r.passed is False


# ── R8: AssertionLLMConfig has timeout_ms ────────────────────────────


class TestLLMConfigTimeout:
    """AssertionLLMConfig must have timeout_ms field with 30s default."""

    def test_default_timeout(self) -> None:
        from evalgate_sdk.assertions import AssertionLLMConfig

        cfg = AssertionLLMConfig()
        assert cfg.timeout_ms == 30_000

    def test_custom_timeout(self) -> None:
        from evalgate_sdk.assertions import AssertionLLMConfig

        cfg = AssertionLLMConfig(timeout_ms=60_000)
        assert cfg.timeout_ms == 60_000
