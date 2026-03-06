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


def contains_keywords(text: str, keywords: Sequence[str]) -> AssertionResult:
    lower = text.lower()
    missing = [kw for kw in keywords if kw.lower() not in lower]
    passed = len(missing) == 0
    return AssertionResult(
        passed=passed,
        assertion_type="containsKeywords",
        message=f"Missing keywords: {missing}" if missing else "All keywords found",
        expected=list(keywords),
        actual=text,
    )


def matches_pattern(text: str, pattern: str | re.Pattern[str]) -> bool:
    if isinstance(pattern, str):
        pattern = re.compile(pattern)
    return pattern.search(text) is not None


def has_length(text: str, *, min: int | None = None, max: int | None = None) -> bool:
    length = len(text)
    if min is not None and length < min:
        return False
    return not (max is not None and length > max)


def contains_json(text: str) -> AssertionResult:
    for start, end in (("{", "}"), ("[", "]")):
        i = text.find(start)
        if i == -1:
            continue
        j = text.rfind(end)
        if j > i:
            try:
                json.loads(text[i : j + 1])
                return AssertionResult(
                    passed=True,
                    assertion_type="containsJSON",
                    message="Valid JSON found",
                    actual=text[i : j + 1],
                )
            except (json.JSONDecodeError, ValueError):
                pass
    return AssertionResult(
        passed=False,
        assertion_type="containsJSON",
        message="No valid JSON found in text",
        actual=text,
    )


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


def has_sentiment(text: str, expected: str) -> AssertionResult:
    words = set(text.lower().split())
    pos = len(words & _POSITIVE_WORDS)
    neg = len(words & _NEGATIVE_WORDS)
    if expected == "positive":
        passed = pos > neg
    elif expected == "negative":
        passed = neg > pos
    else:
        passed = pos == neg  # neutral
    detected = "positive" if pos > neg else ("negative" if neg > pos else "neutral")
    return AssertionResult(
        passed=passed,
        assertion_type="hasSentiment",
        message=f"Expected {expected} sentiment, detected {detected}",
        expected=expected,
        actual=detected,
    )


def _ngrams(text: str, n: int) -> set[str]:
    words = text.lower().split()
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def similar_to(text1: str, text2: str, threshold: float = 0.7) -> AssertionResult:
    if not text1 or not text2:
        passed = text1 == text2
        score = 1.0 if passed else 0.0
    else:
        a = _ngrams(text1, 2) | _ngrams(text1, 1)
        b = _ngrams(text2, 2) | _ngrams(text2, 1)
        score = 1.0 if not a and not b else len(a & b) / max(len(a | b), 1)
        passed = score >= threshold
    op = ">=" if passed else "<"
    return AssertionResult(
        passed=passed,
        assertion_type="similarTo",
        message=f"Similarity {score:.2f} {op} threshold {threshold}",
        expected=threshold,
        actual=score,
    )


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


def has_readability_score(text: str, min_score: float) -> AssertionResult:
    sentences = max(len(re.split(r"[.!?]+", text)), 1)
    words_list = text.split()
    words = max(len(words_list), 1)
    syllables = sum(max(len(re.findall(r"[aeiouy]+", w, re.IGNORECASE)), 1) for w in words_list)
    # Flesch reading ease
    score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    passed = score >= min_score
    op = ">=" if passed else "<"
    return AssertionResult(
        passed=passed,
        assertion_type="hasReadabilityScore",
        message=f"Readability {score:.1f} {op} {min_score}",
        expected=min_score,
        actual=score,
    )


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


def has_factual_accuracy(text: str, facts: Sequence[str], threshold: float = 0.8) -> bool:
    """Check that *text* is consistent with each fact in *facts*.

    Uses word-overlap similarity rather than raw substring matching so that
    paraphrased or reworded facts are still detected while contradictions
    are not silently accepted.

    Entity words (capitalised) in each fact are required to appear in the
    text — a single missing entity (e.g. "Paris" replaced by "London")
    fails the check immediately.
    """
    text_lower = text.lower()
    text_words = set(text_lower.split())
    for fact in facts:
        fact_words = set(fact.lower().split())
        if not fact_words:
            continue
        # Entity check: capitalised words in the fact must appear in text
        entities = {w for w in fact.split() if w[0:1].isupper()}
        for entity in entities:
            if entity.lower() not in text_lower:
                return False
        # Word-overlap check
        overlap = len(text_words & fact_words) / len(fact_words)
        if overlap < threshold:
            return False
    return True


def responded_within_time(start_time: float, max_ms: float) -> bool:
    elapsed = (time.time() - start_time) * 1000
    return elapsed <= max_ms


_TOXIC_WORDS = [
    # ── Profanity ────────────────────────────────────────────────
    "fuck",
    "fucking",
    "fucked",
    "fucker",
    "motherfucker",
    "shit",
    "shitty",
    "bullshit",
    "horseshit",
    "ass",
    "asshole",
    "arsehole",
    "arse",
    "bitch",
    "bitches",
    "bitchy",
    "bastard",
    "damn",
    "dammit",
    "crap",
    "crappy",
    "dick",
    "dickhead",
    "piss",
    "pissed",
    "cunt",
    "twat",
    "wanker",
    "bollocks",
    "cock",
    "cocksucker",
    # ── Racial / ethnic slurs ────────────────────────────────────
    "nigger",
    "nigga",
    "negro",
    "coon",
    "darkie",
    "chink",
    "gook",
    "spic",
    "wetback",
    "beaner",
    "kike",
    "yid",
    "towelhead",
    "raghead",
    "camel jockey",
    "cracker",
    "honky",
    "gringo",
    "redskin",
    "injun",
    "paki",
    "wog",
    "zipperhead",
    # ── Homophobic / transphobic slurs ───────────────────────────
    "faggot",
    "fag",
    "dyke",
    "homo",
    "tranny",
    "shemale",
    "he-she",
    "ladyboy",
    # ── Gendered / sexual slurs ──────────────────────────────────
    "slut",
    "whore",
    "skank",
    "hoe",
    "thot",
    "bimbo",
    "tramp",
    "hooker",
    "prostitute",
    # ── Ableist slurs ────────────────────────────────────────────
    "retard",
    "retarded",
    "spaz",
    "spastic",
    "cripple",
    "midget",
    "mongoloid",
    # ── General insults / dehumanisation ─────────────────────────
    "idiot",
    "stupid",
    "moron",
    "dumb",
    "loser",
    "imbecile",
    "cretin",
    "dimwit",
    "halfwit",
    "degenerate",
    "subhuman",
    "vermin",
    "scum",
    "trash",
    "worthless",
    "pathetic",
    "disgusting",
    # ── Threats / violence ───────────────────────────────────────
    "kill yourself",
    "kys",
    "die",
    "go die",
    "i will kill you",
    "kill you",
    "murder you",
    "shoot you",
    "stab you",
    "hang yourself",
    "hope you die",
    "wish you were dead",
    "shut up",
    "hate you",
    # ── Harassment / sexual harassment ───────────────────────────
    "neck yourself",
    "send nudes",
    "suck my dick",
    "blow me",
    "eat shit",
    "go to hell",
    "burn in hell",
]

_TOXIC_PATTERNS = [re.compile(r"\b" + re.escape(w) + r"\b", re.IGNORECASE) for w in _TOXIC_WORDS]


def has_no_toxicity(text: str) -> AssertionResult:
    matched = [w for w, p in zip(_TOXIC_WORDS, _TOXIC_PATTERNS, strict=False) if p.search(text)]
    passed = len(matched) == 0
    return AssertionResult(
        passed=passed,
        assertion_type="hasNoToxicity",
        message="No toxic content detected" if passed else f"Toxic content detected: {matched}",
        actual=matched if matched else None,
    )


def follows_instructions(text: str, instructions: Sequence[str]) -> bool:
    lower = text.lower()
    return all(inst.lower() in lower for inst in instructions)


def contains_all_required_fields(obj: Any, required_fields: Sequence[str]) -> bool:
    if not isinstance(obj, dict):
        return False
    return all(f in obj for f in required_fields)


_CODE_PATTERNS: dict[str, re.Pattern[str]] = {
    "javascript": re.compile(
        r"(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|=>\s*[{(]|module\.exports\s*=)"
    ),
    "typescript": re.compile(
        r"(interface\s+\w+|type\s+\w+\s*=|const\s+\w+\s*[=:]|function\s+\w+|=>\s*[{(]|export\s+(default\s+)?[{a-z])"
    ),
    "java": re.compile(r"(public\s+class\s+|private\s+|void\s+\w+\s*\(|import\s+java\.)"),
    "go": re.compile(r'(func\s+\w+|package\s+\w+|import\s+[("]\s*|type\s+\w+\s+struct)'),
    "rust": re.compile(r"(fn\s+\w+|let\s+(mut\s+)?\w+|pub\s+(fn|struct|enum)|use\s+\w+|impl\s+\w+|struct\s+\w+)"),
}


def has_valid_code_syntax(code: str, language: str) -> bool:
    lang = language.lower()
    if lang == "python":
        import ast

        try:
            ast.parse(code)
            return True
        except SyntaxError:
            return False
    pattern = _CODE_PATTERNS.get(lang)
    if pattern is None:
        return len(code.strip()) > 0
    return pattern.search(code) is not None


def has_pii(text: str) -> bool:
    """Return ``True`` if PII is detected (inverse of ``not_contains_pii``)."""
    return not not_contains_pii(text)


def has_sentiment_with_score(
    text: str,
    expected: str,
) -> dict[str, Any]:
    """Return sentiment, confidence score, and whether it matches *expected*.

    Uses the same heuristic word-list approach as ``has_sentiment`` but also
    produces a confidence value in 0–1.  Confidence scales with both the
    *margin* between positive/negative counts and the *magnitude* (how many
    sentiment words relative to total words), matching the TS implementation.
    """
    all_words = text.lower().split()
    word_set = set(all_words)
    total_words = len(all_words)
    pos = len(word_set & _POSITIVE_WORDS)
    neg = len(word_set & _NEGATIVE_WORDS)
    sentiment_count = pos + neg

    # Minimum evidence floor: require at least MIN_EVIDENCE_WORDS of
    # context before confidence can approach 1.0.  A single sentiment
    # word ("good") should never hit 1.0 on its own.
    _MIN_EVIDENCE_WORDS = 5

    if sentiment_count == 0:
        sentiment = "neutral"
        confidence = 0.5
    elif pos > neg:
        sentiment = "positive"
        margin = (pos - neg) / sentiment_count
        magnitude = min(sentiment_count / max(total_words, _MIN_EVIDENCE_WORDS), 1.0)
        confidence = 0.5 + 0.5 * margin * magnitude
    elif neg > pos:
        sentiment = "negative"
        margin = (neg - pos) / sentiment_count
        magnitude = min(sentiment_count / max(total_words, _MIN_EVIDENCE_WORDS), 1.0)
        confidence = 0.5 + 0.5 * margin * magnitude
    else:
        sentiment = "neutral"
        confidence = 0.5

    return {"sentiment": sentiment, "confidence": round(confidence, 4), "matches": sentiment == expected}


def has_consistency(outputs: Sequence[str], threshold: float = 0.7) -> dict[str, Any]:
    """Check multi-output consistency using pairwise similarity.

    Returns ``{"score": float, "passed": bool}``.
    """
    if len(outputs) < 2:
        return {"score": 1.0, "passed": True}
    total = 0.0
    count = 0
    for i in range(len(outputs)):
        for j in range(i + 1, len(outputs)):
            a = _ngrams(outputs[i], 2) | _ngrams(outputs[i], 1)
            b = _ngrams(outputs[j], 2) | _ngrams(outputs[j], 1)
            union = len(a | b)
            score = len(a & b) / max(union, 1)
            total += score
            count += 1
    avg = total / max(count, 1)
    return {"score": avg, "passed": avg >= threshold}


def responded_within_duration(duration_ms: float, max_ms: float) -> AssertionResult:
    """Check that an elapsed duration (in ms) is within the allowed limit.

    Returns an ``AssertionResult`` (matches TS ``respondedWithinDuration``).
    """
    passed = duration_ms <= max_ms
    return AssertionResult(
        passed=passed,
        assertion_type="respondedWithinDuration",
        message=f"Duration {duration_ms:.1f}ms {'<=' if passed else '>'} {max_ms:.1f}ms",
        expected=max_ms,
        actual=duration_ms,
    )


def responded_within_time_since(start_time: float, max_ms: float) -> AssertionResult:
    """Check that elapsed time since *start_time* (``time.time()``) is within *max_ms*.

    Returns an ``AssertionResult`` (matches TS ``respondedWithinTimeSince``).
    """
    elapsed = (time.time() - start_time) * 1000
    passed = elapsed <= max_ms
    return AssertionResult(
        passed=passed,
        assertion_type="respondedWithinTimeSince",
        message=f"Elapsed {elapsed:.1f}ms {'<=' if passed else '>'} {max_ms:.1f}ms",
        expected=max_ms,
        actual=elapsed,
    )


# ── LLM-backed assertion configuration ──────────────────────────────


@dataclass
class AssertionLLMConfig:
    """Configuration for LLM-backed async assertions."""

    provider: str = "openai"
    model: str = "gpt-4o-mini"
    api_key: str | None = None
    temperature: float = 0.0
    max_tokens: int = 100
    timeout_ms: int = 30_000


_assertion_llm_config: AssertionLLMConfig | None = None


def configure_assertions(config: AssertionLLMConfig) -> None:
    """Set the global LLM configuration for async assertions."""
    global _assertion_llm_config
    _assertion_llm_config = config


def get_assertion_config() -> AssertionLLMConfig | None:
    """Return the current global LLM assertion config (or ``None``)."""
    return _assertion_llm_config


async def _llm_ask(prompt: str, config: AssertionLLMConfig | None = None) -> str:
    """Send a single-turn prompt to the configured LLM and return the text.

    Enforces ``config.timeout_ms`` (default 30 s) via ``asyncio.wait_for``
    so a hung LLM call cannot block the entire run indefinitely.
    """
    import asyncio

    cfg = config or _assertion_llm_config
    if cfg is None:
        raise RuntimeError("No LLM config set. Call configure_assertions() first or pass a config.")

    timeout_s = cfg.timeout_ms / 1000.0

    async def _call() -> str:
        if cfg.provider == "openai":
            try:
                import openai
            except ImportError as exc:
                raise ImportError("openai package required for async assertions: pip install openai") from exc
            client = openai.AsyncOpenAI(api_key=cfg.api_key)
            resp = await client.chat.completions.create(
                model=cfg.model,
                temperature=cfg.temperature,
                max_tokens=cfg.max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return (resp.choices[0].message.content or "").strip()

        if cfg.provider == "anthropic":
            try:
                import anthropic
            except ImportError as exc:
                raise ImportError("anthropic package required for async assertions: pip install anthropic") from exc
            client = anthropic.AsyncAnthropic(api_key=cfg.api_key)
            resp = await client.messages.create(
                model=cfg.model,
                max_tokens=cfg.max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            block = resp.content[0]
            return (block.text if hasattr(block, "text") else str(block)).strip()

        raise ValueError(f"Unsupported LLM provider: {cfg.provider}")

    return await asyncio.wait_for(_call(), timeout=timeout_s)


# ── Async / LLM-backed assertion functions ───────────────────────────


async def has_sentiment_async(
    text: str,
    expected: str,
    config: AssertionLLMConfig | None = None,
) -> bool:
    """LLM-powered sentiment analysis — more accurate than the heuristic version."""
    result = await _llm_ask(
        "Classify the sentiment of the following text as exactly one word: "
        f'positive, negative, or neutral.\n\nText: "{text}"\n\nSentiment:',
        config,
    )
    return result.lower().replace(".", "").strip() == expected.lower()


async def has_no_toxicity_async(
    text: str,
    config: AssertionLLMConfig | None = None,
) -> bool:
    """LLM-powered toxicity check — detects subtle harmful content blocklists miss."""
    result = await _llm_ask(
        "Does the following text contain toxic, harmful, or offensive content? "
        f'Answer exactly "yes" or "no".\n\nText: "{text}"\n\nAnswer:',
        config,
    )
    return re.sub(r"[^a-z]", "", result.lower()) == "no"


async def contains_language_async(
    text: str,
    language: str,
    config: AssertionLLMConfig | None = None,
) -> bool:
    """LLM-powered language detection."""
    result = await _llm_ask(
        f'Is the following text written in {language}? Answer exactly "yes" or "no".\n\nText: "{text}"\n\nAnswer:',
        config,
    )
    return re.sub(r"[^a-z]", "", result.lower()) == "yes"


async def has_valid_code_syntax_async(
    code: str,
    language: str,
    config: AssertionLLMConfig | None = None,
) -> bool:
    """LLM-powered code syntax validation."""
    result = await _llm_ask(
        f"Is the following code valid {language} syntax? "
        f'Answer exactly "yes" or "no".\n\n```{language}\n{code}\n```\n\nAnswer:',
        config,
    )
    return re.sub(r"[^a-z]", "", result.lower()) == "yes"


async def has_factual_accuracy_async(
    text: str,
    facts: Sequence[str],
    config: AssertionLLMConfig | None = None,
) -> bool:
    """LLM-powered factual accuracy check."""
    facts_str = "\n".join(f"- {f}" for f in facts)
    result = await _llm_ask(
        "Does the following text accurately reflect ALL of these facts? "
        f'Answer exactly "yes" or "no".\n\nFacts:\n{facts_str}\n\n'
        f'Text: "{text}"\n\nAnswer:',
        config,
    )
    return re.sub(r"[^a-z]", "", result.lower()) == "yes"


async def has_no_hallucinations_async(
    text: str,
    ground_truth: Sequence[str],
    config: AssertionLLMConfig | None = None,
) -> bool:
    """LLM-powered hallucination detection — catches paraphrased fabrications."""
    facts_str = "\n".join(f"- {f}" for f in ground_truth)
    result = await _llm_ask(
        f"Does the following text contain ONLY information supported by the given ground truth? "
        f'Answer exactly "yes" if no hallucinations, "no" if it contains fabricated claims.\n\n'
        f'Ground truth:\n{facts_str}\n\nText: "{text}"\n\nAnswer:',
        config,
    )
    return re.sub(r"[^a-z]", "", result.lower()) == "yes"


async def has_consistency_async(
    outputs: Sequence[str],
    config: AssertionLLMConfig | None = None,
) -> dict[str, Any]:
    """LLM-powered multi-output consistency check."""
    if len(outputs) < 2:
        return {"score": 1.0, "passed": True}
    outputs_str = "\n".join(f"Output {i + 1}: {o}" for i, o in enumerate(outputs))
    result = await _llm_ask(
        f"Rate the consistency of these outputs on a scale of 0.0 to 1.0 "
        f"(1.0 = perfectly consistent). Reply with ONLY the number.\n\n{outputs_str}\n\nScore:",
        config,
    )
    try:
        score = float(re.search(r"[\d.]+", result).group())  # type: ignore[union-attr]
        score = max(0.0, min(1.0, score))
    except (AttributeError, ValueError):
        score = 0.5
    return {"score": score, "passed": score >= 0.7}


async def to_semantically_contain(
    text: str,
    phrase: str,
    config: AssertionLLMConfig | None = None,
) -> dict[str, Any]:
    """LLM-powered semantic containment check.

    Returns ``{"contains": bool, "similarity": float}``.
    """
    result = await _llm_ask(
        f'Does the following text semantically contain or convey the meaning of "{phrase}"? '
        f'Answer with a JSON object: {{"contains": true/false, "similarity": 0.0-1.0}}\n\n'
        f'Text: "{text}"\n\nAnswer:',
        config,
    )
    try:
        parsed = json.loads(result)
        return {"contains": bool(parsed.get("contains")), "similarity": float(parsed.get("similarity", 0))}
    except (json.JSONDecodeError, ValueError):
        contains = "true" in result.lower() or "yes" in result.lower()
        return {"contains": contains, "similarity": 0.5 if contains else 0.0}


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
        result = contains_keywords(str(self._value), keywords)
        return AssertionResult(
            passed=result.passed,
            assertion_type="containsKeywords",
            message=message or result.message,
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
        result = has_sentiment(str(self._value), expected)
        return AssertionResult(
            passed=result.passed,
            assertion_type="sentiment",
            message=message or result.message,
            expected=expected,
            actual=result.actual,
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

    def to_have_no_profanity(self, message: str = "") -> AssertionResult:
        result = has_no_toxicity(str(self._value))
        return AssertionResult(
            passed=result.passed,
            assertion_type="noProfanity",
            message=message or result.message,
            actual=result.actual,
        )

    def to_be_professional(self, message: str = "") -> AssertionResult:
        result = has_no_toxicity(str(self._value))
        return AssertionResult(
            passed=result.passed,
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
