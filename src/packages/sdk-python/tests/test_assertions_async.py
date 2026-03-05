"""Tests for new sync assertions + async/LLM-backed assertion infrastructure (T1)."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import pytest

from evalgate_sdk.assertions import (
    AssertionLLMConfig,
    AssertionResult,
    configure_assertions,
    contains_language_async,
    get_assertion_config,
    has_consistency,
    has_consistency_async,
    has_factual_accuracy_async,
    has_no_hallucinations_async,
    has_no_toxicity_async,
    has_pii,
    has_sentiment_async,
    has_sentiment_with_score,
    has_valid_code_syntax_async,
    responded_within_duration,
    responded_within_time_since,
    to_semantically_contain,
)

# ── Sync assertion tests ─────────────────────────────────────────────


class TestHasPII:
    def test_detects_ssn(self) -> None:
        assert has_pii("My SSN is 123-45-6789") is True

    def test_clean_text(self) -> None:
        assert has_pii("Hello world") is False


class TestHasSentimentWithScore:
    def test_positive(self) -> None:
        result = has_sentiment_with_score("This is great and amazing!", "positive")
        assert result["sentiment"] == "positive"
        assert result["matches"] is True
        assert result["confidence"] > 0.5

    def test_negative(self) -> None:
        result = has_sentiment_with_score("This is terrible and awful", "negative")
        assert result["sentiment"] == "negative"
        assert result["matches"] is True

    def test_neutral(self) -> None:
        result = has_sentiment_with_score("The cat sat on the mat", "neutral")
        assert result["sentiment"] == "neutral"
        assert result["matches"] is True

    def test_mismatch(self) -> None:
        result = has_sentiment_with_score("This is great", "negative")
        assert result["matches"] is False


class TestHasConsistency:
    def test_identical_outputs(self) -> None:
        result = has_consistency(["Hello world", "Hello world"])
        assert result["score"] == 1.0
        assert result["passed"] is True

    def test_single_output(self) -> None:
        result = has_consistency(["Hello"])
        assert result["score"] == 1.0
        assert result["passed"] is True

    def test_divergent_outputs(self) -> None:
        result = has_consistency(["The sky is blue", "Pizza is delicious", "Quantum mechanics"])
        assert result["score"] < 0.7
        assert result["passed"] is False


class TestRespondedWithinDuration:
    def test_within_limit(self) -> None:
        result = responded_within_duration(50.0, 100.0)
        assert isinstance(result, AssertionResult)
        assert result.passed is True

    def test_exceeds_limit(self) -> None:
        result = responded_within_duration(150.0, 100.0)
        assert result.passed is False

    def test_exact_boundary(self) -> None:
        result = responded_within_duration(100.0, 100.0)
        assert result.passed is True


class TestRespondedWithinTimeSince:
    def test_within_limit(self) -> None:
        start = time.time()
        result = responded_within_time_since(start, 5000.0)
        assert result.passed is True

    def test_exceeds_limit(self) -> None:
        start = time.time() - 1.0  # 1 second ago
        result = responded_within_time_since(start, 10.0)  # 10ms limit
        assert result.passed is False


# ── LLM config tests ─────────────────────────────────────────────────


class TestAssertionLLMConfig:
    def test_configure_and_get(self) -> None:
        cfg = AssertionLLMConfig(provider="openai", model="gpt-4o-mini")
        configure_assertions(cfg)
        assert get_assertion_config() is cfg

    def test_default_values(self) -> None:
        cfg = AssertionLLMConfig()
        assert cfg.provider == "openai"
        assert cfg.model == "gpt-4o-mini"
        assert cfg.temperature == 0.0


# ── Async assertion tests (mocked LLM) ──────────────────────────────


@pytest.fixture(autouse=True)
def _setup_config() -> None:
    configure_assertions(AssertionLLMConfig(provider="openai", model="gpt-4o-mini", api_key="test"))


def _patch_llm(return_text: str):
    """Patch ``_llm_ask`` to return *return_text* without hitting a real LLM."""
    return patch("evalgate_sdk.assertions._llm_ask", new=AsyncMock(return_value=return_text))


@pytest.mark.asyncio
async def test_has_sentiment_async() -> None:
    with _patch_llm("positive"):
        result = await has_sentiment_async("I love this product!", "positive")
        assert result is True


@pytest.mark.asyncio
async def test_has_no_toxicity_async() -> None:
    with _patch_llm("no"):
        result = await has_no_toxicity_async("Have a great day!")
        assert result is True


@pytest.mark.asyncio
async def test_contains_language_async() -> None:
    with _patch_llm("yes"):
        result = await contains_language_async("Hello world", "English")
        assert result is True


@pytest.mark.asyncio
async def test_has_valid_code_syntax_async() -> None:
    with _patch_llm("yes"):
        result = await has_valid_code_syntax_async("def foo(): pass", "python")
        assert result is True


@pytest.mark.asyncio
async def test_has_factual_accuracy_async() -> None:
    with _patch_llm("yes"):
        result = await has_factual_accuracy_async("Water boils at 100C", ["Water boils at 100C"])
        assert result is True


@pytest.mark.asyncio
async def test_has_no_hallucinations_async() -> None:
    with _patch_llm("yes"):
        result = await has_no_hallucinations_async("The sky is blue", ["The sky is blue"])
        assert result is True


@pytest.mark.asyncio
async def test_has_consistency_async() -> None:
    with _patch_llm("0.9"):
        result = await has_consistency_async(["Hello world", "Hello world!"])
        assert result["passed"] is True
        assert result["score"] == 0.9


@pytest.mark.asyncio
async def test_to_semantically_contain_json() -> None:
    with _patch_llm('{"contains": true, "similarity": 0.85}'):
        result = await to_semantically_contain("The sky is blue and beautiful", "blue sky")
        assert result["contains"] is True
        assert result["similarity"] == 0.85


@pytest.mark.asyncio
async def test_to_semantically_contain_fallback() -> None:
    with _patch_llm("Yes, it contains it"):
        result = await to_semantically_contain("The sky is blue", "blue sky")
        assert result["contains"] is True
