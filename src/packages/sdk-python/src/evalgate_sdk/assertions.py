"""Assertion library for evaluating LLM outputs.

Provides both standalone functions and an ``expect()`` fluent API matching
the TypeScript SDK's assertion surface.
"""

from __future__ import annotations

import json
import re
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any


@dataclass
class AssertionResult:
    passed: bool
    assertion_type: str
    message: str
    expected: Any = None
    actual: Any = None


# ── Standalone assertion functions ───────────────────────────────────


def contains_keywords(text: str, keywords: Sequence[str]) -> bool:
    lower = text.lower()
    return all(kw.lower() in lower for kw in keywords)


def matches_pattern(text: str, pattern: str | re.Pattern[str]) -> bool:
    if isinstance(pattern, str):
        pattern = re.compile(pattern)
    return pattern.search(text) is not None


def has_length(text: str, *, min: int | None = None, max: int | None = None) -> bool:
    length = len(text)
    if min is not None and length < min:
        return False
    return not (max is not None and length > max)


def contains_json(text: str) -> bool:
    for start, end in (("{", "}"), ("[", "]")):
        i = text.find(start)
        if i == -1:
            continue
        j = text.rfind(end)
        if j > i:
            try:
                json.loads(text[i : j + 1])
                return True
            except (json.JSONDecodeError, ValueError):
                pass
    return False


_PII_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # SSN
    re.compile(r"\b\d{16}\b"),  # credit card (no sep)
    re.compile(r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b"),  # credit card
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),  # email
    re.compile(r"\b\d{3}[-.)]?\s?\d{3}[-.)]?\s?\d{4}\b"),  # phone
]


def not_contains_pii(text: str) -> bool:
    return not any(p.search(text) for p in _PII_PATTERNS)


_POSITIVE_WORDS = frozenset(
    [
        "good",
        "great",
        "excellent",
        "wonderful",
        "fantastic",
        "amazing",
        "love",
        "best",
        "happy",
        "positive",
        "brilliant",
        "outstanding",
    ]
)
_NEGATIVE_WORDS = frozenset(
    [
        "bad",
        "terrible",
        "awful",
        "horrible",
        "worst",
        "hate",
        "poor",
        "negative",
        "disappointing",
        "dreadful",
        "ugly",
    ]
)


def has_sentiment(text: str, expected: str) -> bool:
    words = set(text.lower().split())
    pos = len(words & _POSITIVE_WORDS)
    neg = len(words & _NEGATIVE_WORDS)
    if expected == "positive":
        return pos > neg
    if expected == "negative":
        return neg > pos
    return pos == neg  # neutral


def _ngrams(text: str, n: int) -> set[str]:
    words = text.lower().split()
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def similar_to(text1: str, text2: str, threshold: float = 0.7) -> bool:
    if not text1 or not text2:
        return text1 == text2
    a = _ngrams(text1, 2) | _ngrams(text1, 1)
    b = _ngrams(text2, 2) | _ngrams(text2, 1)
    if not a and not b:
        return True
    score = len(a & b) / max(len(a | b), 1)
    return score >= threshold


def within_range(value: float, min_val: float, max_val: float) -> bool:
    return min_val <= value <= max_val


def is_valid_email(email: str) -> bool:
    return bool(re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$", email))


def is_valid_url(url: str) -> bool:
    return bool(re.match(r"^https?://[^\s/$.?#].\S*$", url, re.IGNORECASE))


def has_no_hallucinations(text: str, ground_truth: Sequence[str]) -> bool:
    lower = text.lower()
    return all(fact.lower() in lower for fact in ground_truth)


def matches_schema(value: Any, schema: dict[str, Any]) -> bool:
    if not isinstance(value, dict):
        return False
    for key, expected_type in schema.items():
        if key not in value:
            return False
        if isinstance(expected_type, type) and not isinstance(value[key], expected_type):
            return False
    return True


def has_readability_score(text: str, min_score: float) -> bool:
    sentences = max(len(re.split(r"[.!?]+", text)), 1)
    words_list = text.split()
    words = max(len(words_list), 1)
    syllables = sum(max(len(re.findall(r"[aeiouy]+", w, re.IGNORECASE)), 1) for w in words_list)
    # Flesch reading ease
    score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    return score >= min_score


def contains_language(text: str, language: str) -> bool:
    # Simplified heuristic — checks for common words per language
    _LANG_MARKERS: dict[str, list[str]] = {
        "english": ["the", "is", "and", "of", "to"],
        "spanish": ["el", "la", "de", "en", "es"],
        "french": ["le", "la", "de", "et", "les"],
        "german": ["der", "die", "und", "ist", "das"],
    }
    markers = _LANG_MARKERS.get(language.lower(), [])
    if not markers:
        return True  # unknown language, can't verify
    words = set(text.lower().split())
    return any(m in words for m in markers)


def has_factual_accuracy(text: str, facts: Sequence[str]) -> bool:
    lower = text.lower()
    return all(f.lower() in lower for f in facts)


def responded_within_time(start_time: float, max_ms: float) -> bool:
    elapsed = (time.time() - start_time) * 1000
    return elapsed <= max_ms


_TOXIC_WORDS = frozenset(
    [
        "idiot",
        "stupid",
        "moron",
        "dumb",
        "loser",
        "shut up",
        "kill",
        "die",
        "hate you",
    ]
)


def has_no_toxicity(text: str) -> bool:
    lower = text.lower()
    return not any(w in lower for w in _TOXIC_WORDS)


def follows_instructions(text: str, instructions: Sequence[str]) -> bool:
    lower = text.lower()
    return all(inst.lower() in lower for inst in instructions)


def contains_all_required_fields(obj: Any, required_fields: Sequence[str]) -> bool:
    if not isinstance(obj, dict):
        return False
    return all(f in obj for f in required_fields)


_CODE_PATTERNS: dict[str, re.Pattern[str]] = {
    "python": re.compile(r"(def |class |import |from .+ import |if __name__)"),
    "javascript": re.compile(r"(function |const |let |var |=>|module\.exports)"),
    "typescript": re.compile(r"(interface |type |const |function |=>|export )"),
    "java": re.compile(r"(public |private |class |void |import java)"),
    "go": re.compile(r"(func |package |import |type .+ struct)"),
    "rust": re.compile(r"(fn |let |pub |use |impl |struct )"),
}


def has_valid_code_syntax(code: str, language: str) -> bool:
    pattern = _CODE_PATTERNS.get(language.lower())
    if pattern is None:
        return len(code.strip()) > 0
    return pattern.search(code) is not None


# ── Fluent expect() API ──────────────────────────────────────────────


class Expectation:
    """Chainable assertion builder returned by ``expect(value)``."""

    def __init__(self, value: Any) -> None:
        self._value = value

    def to_equal(self, expected: Any, message: str = "") -> AssertionResult:
        passed = self._value == expected
        return AssertionResult(
            passed=passed,
            assertion_type="equal",
            message=message or f"Expected {expected!r}, got {self._value!r}",
            expected=expected,
            actual=self._value,
        )

    def to_contain(self, substring: str, message: str = "") -> AssertionResult:
        passed = substring in str(self._value)
        return AssertionResult(
            passed=passed,
            assertion_type="contain",
            message=message or f"Expected to contain '{substring}'",
            expected=substring,
            actual=self._value,
        )

    def to_contain_keywords(self, keywords: Sequence[str], message: str = "") -> AssertionResult:
        passed = contains_keywords(str(self._value), keywords)
        return AssertionResult(
            passed=passed,
            assertion_type="containsKeywords",
            message=message or f"Expected keywords {keywords}",
            expected=keywords,
            actual=self._value,
        )

    def to_not_contain(self, substring: str, message: str = "") -> AssertionResult:
        passed = substring not in str(self._value)
        return AssertionResult(
            passed=passed,
            assertion_type="notContain",
            message=message or f"Expected not to contain '{substring}'",
            expected=substring,
            actual=self._value,
        )

    def to_not_contain_pii(self, message: str = "") -> AssertionResult:
        passed = not_contains_pii(str(self._value))
        return AssertionResult(
            passed=passed,
            assertion_type="notContainsPII",
            message=message or "Expected no PII",
        )

    def to_match_pattern(self, pattern: str | re.Pattern[str], message: str = "") -> AssertionResult:
        passed = matches_pattern(str(self._value), pattern)
        return AssertionResult(
            passed=passed,
            assertion_type="matchesPattern",
            message=message or "Expected to match pattern",
            expected=str(pattern),
            actual=self._value,
        )

    def to_be_valid_json(self, message: str = "") -> AssertionResult:
        try:
            json.loads(str(self._value))
            passed = True
        except (json.JSONDecodeError, ValueError):
            passed = False
        return AssertionResult(
            passed=passed,
            assertion_type="validJSON",
            message=message or "Expected valid JSON",
        )

    def to_match_json(self, schema: dict[str, Any], message: str = "") -> AssertionResult:
        try:
            parsed = json.loads(str(self._value)) if isinstance(self._value, str) else self._value
            passed = matches_schema(parsed, schema)
        except (json.JSONDecodeError, ValueError):
            passed = False
        return AssertionResult(
            passed=passed,
            assertion_type="matchesJSON",
            message=message or "Expected to match JSON schema",
            expected=schema,
            actual=self._value,
        )

    def to_have_sentiment(self, expected: str, message: str = "") -> AssertionResult:
        passed = has_sentiment(str(self._value), expected)
        return AssertionResult(
            passed=passed,
            assertion_type="sentiment",
            message=message or f"Expected {expected} sentiment",
            expected=expected,
            actual=self._value,
        )

    def to_have_length(self, *, min: int | None = None, max: int | None = None, message: str = "") -> AssertionResult:
        passed = has_length(str(self._value), min=min, max=max)
        return AssertionResult(
            passed=passed,
            assertion_type="length",
            message=message or f"Expected length in [{min}, {max}]",
            expected={"min": min, "max": max},
            actual=len(str(self._value)),
        )

    def to_not_hallucinate(self, ground_truth: Sequence[str], message: str = "") -> AssertionResult:
        passed = has_no_hallucinations(str(self._value), ground_truth)
        return AssertionResult(
            passed=passed,
            assertion_type="noHallucinations",
            message=message or "Expected no hallucinations",
            expected=ground_truth,
            actual=self._value,
        )

    def to_be_faster_than(self, max_ms: float, message: str = "") -> AssertionResult:
        passed = isinstance(self._value, (int, float)) and self._value <= max_ms
        return AssertionResult(
            passed=passed,
            assertion_type="fasterThan",
            message=message or f"Expected < {max_ms}ms",
            expected=max_ms,
            actual=self._value,
        )

    def to_be_truthy(self, message: str = "") -> AssertionResult:
        passed = bool(self._value)
        return AssertionResult(
            passed=passed,
            assertion_type="truthy",
            message=message or "Expected truthy value",
        )

    def to_be_falsy(self, message: str = "") -> AssertionResult:
        passed = not bool(self._value)
        return AssertionResult(
            passed=passed,
            assertion_type="falsy",
            message=message or "Expected falsy value",
        )

    def to_be_greater_than(self, expected: float, message: str = "") -> AssertionResult:
        passed = isinstance(self._value, (int, float)) and self._value > expected
        return AssertionResult(
            passed=passed,
            assertion_type="greaterThan",
            message=message or f"Expected > {expected}",
            expected=expected,
            actual=self._value,
        )

    def to_be_less_than(self, expected: float, message: str = "") -> AssertionResult:
        passed = isinstance(self._value, (int, float)) and self._value < expected
        return AssertionResult(
            passed=passed,
            assertion_type="lessThan",
            message=message or f"Expected < {expected}",
            expected=expected,
            actual=self._value,
        )

    def to_be_between(self, min_val: float, max_val: float, message: str = "") -> AssertionResult:
        passed = isinstance(self._value, (int, float)) and within_range(self._value, min_val, max_val)
        return AssertionResult(
            passed=passed,
            assertion_type="between",
            message=message or f"Expected between {min_val} and {max_val}",
            expected={"min": min_val, "max": max_val},
            actual=self._value,
        )

    def to_contain_code(self, message: str = "") -> AssertionResult:
        passed = bool(re.search(r"```|def |function |class |const |import ", str(self._value)))
        return AssertionResult(
            passed=passed,
            assertion_type="containsCode",
            message=message or "Expected to contain code",
        )

    def to_be_professional(self, message: str = "") -> AssertionResult:
        passed = has_no_toxicity(str(self._value))
        return AssertionResult(
            passed=passed,
            assertion_type="professional",
            message=message or "Expected professional tone",
        )

    def to_have_proper_grammar(self, message: str = "") -> AssertionResult:
        text = str(self._value).strip()
        passed = len(text) > 0 and text[0].isupper() and text[-1] in ".!?"
        return AssertionResult(
            passed=passed,
            assertion_type="properGrammar",
            message=message or "Expected proper grammar",
        )


def expect(value: Any) -> Expectation:
    """Create an assertion chain for the given value.

    Usage::

        result = expect("Hello world").to_contain("Hello")
        assert result.passed
    """
    return Expectation(value)


def run_assertions(
    assertions: Sequence[Callable[[], AssertionResult]],
) -> list[AssertionResult]:
    """Run multiple assertions and collect results.

    Each assertion is a zero-argument callable that returns an ``AssertionResult``.
    Exceptions are caught and turned into failing results.

    Usage::

        results = run_assertions([
            lambda: expect(output).to_contain("help"),
            lambda: expect(output).to_have_sentiment("positive"),
            lambda: expect(output).to_have_length(min_len=10),
        ])
        all_passed = all(r.passed for r in results)
    """
    results: list[AssertionResult] = []
    for assertion in assertions:
        try:
            results.append(assertion())
        except Exception as exc:
            results.append(
                AssertionResult(
                    passed=False,
                    assertion_type="unknown",
                    message=str(exc),
                    expected=None,
                    actual=None,
                )
            )
    return results
