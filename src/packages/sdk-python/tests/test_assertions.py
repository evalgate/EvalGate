"""Tests for the assertion library."""

import re
import time

from evalai_sdk.assertions import (
    contains_all_required_fields,
    contains_json,
    contains_keywords,
    expect,
    follows_instructions,
    has_length,
    has_no_hallucinations,
    has_no_toxicity,
    has_sentiment,
    has_valid_code_syntax,
    is_valid_email,
    is_valid_url,
    matches_pattern,
    matches_schema,
    not_contains_pii,
    responded_within_time,
    similar_to,
    within_range,
)

# ── Standalone functions ─────────────────────────────────────────────


class TestContainsKeywords:
    def test_all_present(self):
        assert contains_keywords("The quick brown fox", ["quick", "fox"])

    def test_case_insensitive(self):
        assert contains_keywords("Hello World", ["hello", "WORLD"])

    def test_missing_keyword(self):
        assert not contains_keywords("Hello", ["hello", "world"])


class TestMatchesPattern:
    def test_string_pattern(self):
        assert matches_pattern("abc-123", r"\w+-\d+")

    def test_compiled_pattern(self):
        assert matches_pattern("test@example.com", re.compile(r".+@.+\..+"))

    def test_no_match(self):
        assert not matches_pattern("hello", r"^\d+$")


class TestHasLength:
    def test_within_range(self):
        assert has_length("hello", min=3, max=10)

    def test_too_short(self):
        assert not has_length("hi", min=5)

    def test_too_long(self):
        assert not has_length("hello world", max=5)


class TestContainsJSON:
    def test_json_in_text(self):
        assert contains_json('Here is the data: {"key": "value"} end')

    def test_no_json(self):
        assert not contains_json("no json here")

    def test_array_json(self):
        assert contains_json("result: [1, 2, 3]")


class TestNotContainsPII:
    def test_clean_text(self):
        assert not_contains_pii("The weather is nice today")

    def test_ssn(self):
        assert not not_contains_pii("SSN: 123-45-6789")

    def test_email(self):
        assert not not_contains_pii("Contact me at john@example.com")


class TestHasSentiment:
    def test_positive(self):
        assert has_sentiment("This is great and wonderful!", "positive")

    def test_negative(self):
        assert has_sentiment("This is terrible and awful", "negative")

    def test_neutral(self):
        assert has_sentiment("The sky is blue", "neutral")


class TestSimilarTo:
    def test_identical(self):
        assert similar_to("hello world", "hello world")

    def test_similar(self):
        assert similar_to("the quick brown fox", "the quick brown dog", threshold=0.5)

    def test_different(self):
        assert not similar_to("hello", "goodbye world", threshold=0.8)


class TestWithinRange:
    def test_in_range(self):
        assert within_range(5, 1, 10)

    def test_at_boundary(self):
        assert within_range(1, 1, 10)

    def test_out_of_range(self):
        assert not within_range(15, 1, 10)


class TestValidators:
    def test_valid_email(self):
        assert is_valid_email("test@example.com")
        assert not is_valid_email("not-an-email")

    def test_valid_url(self):
        assert is_valid_url("https://example.com")
        assert not is_valid_url("not a url")


class TestHasNoHallucinations:
    def test_all_facts_present(self):
        assert has_no_hallucinations("Paris is the capital of France", ["Paris", "France"])

    def test_missing_fact(self):
        assert not has_no_hallucinations("Paris is nice", ["capital"])


class TestMatchesSchema:
    def test_valid(self):
        assert matches_schema({"name": "test", "age": 25}, {"name": str, "age": int})

    def test_missing_key(self):
        assert not matches_schema({"name": "test"}, {"name": str, "age": int})


class TestHasNoToxicity:
    def test_clean(self):
        assert has_no_toxicity("Have a wonderful day")

    def test_toxic(self):
        assert not has_no_toxicity("You are an idiot")


class TestFollowsInstructions:
    def test_follows(self):
        assert follows_instructions("Please use bullet points and be concise", ["bullet points", "concise"])

    def test_missing(self):
        assert not follows_instructions("Here is a paragraph", ["bullet points"])


class TestContainsAllRequiredFields:
    def test_all_present(self):
        assert contains_all_required_fields({"a": 1, "b": 2}, ["a", "b"])

    def test_missing(self):
        assert not contains_all_required_fields({"a": 1}, ["a", "b"])


class TestHasValidCodeSyntax:
    def test_python(self):
        assert has_valid_code_syntax("def hello():\n    return 'hi'", "python")

    def test_javascript(self):
        assert has_valid_code_syntax("const x = () => 42;", "javascript")

    def test_invalid(self):
        assert not has_valid_code_syntax("just some text", "python")


class TestRespondedWithinTime:
    def test_within(self):
        start = time.time()
        assert responded_within_time(start, 5000)


# ── expect() fluent API ──────────────────────────────────────────────


class TestExpect:
    def test_to_equal(self):
        r = expect("hello").to_equal("hello")
        assert r.passed

    def test_to_contain(self):
        r = expect("hello world").to_contain("world")
        assert r.passed

    def test_to_contain_keywords(self):
        r = expect("The quick brown fox").to_contain_keywords(["quick", "fox"])
        assert r.passed

    def test_to_not_contain(self):
        r = expect("hello").to_not_contain("world")
        assert r.passed

    def test_to_not_contain_pii(self):
        r = expect("The weather is nice").to_not_contain_pii()
        assert r.passed

    def test_to_match_pattern(self):
        r = expect("abc-123").to_match_pattern(r"\w+-\d+")
        assert r.passed

    def test_to_be_valid_json(self):
        r = expect('{"key": "value"}').to_be_valid_json()
        assert r.passed

    def test_to_have_sentiment(self):
        r = expect("This is great and wonderful!").to_have_sentiment("positive")
        assert r.passed

    def test_to_have_length(self):
        r = expect("hello").to_have_length(min=3, max=10)
        assert r.passed

    def test_to_be_truthy(self):
        assert expect("hello").to_be_truthy().passed
        assert expect("").to_be_falsy().passed

    def test_to_be_greater_than(self):
        assert expect(10).to_be_greater_than(5).passed

    def test_to_be_less_than(self):
        assert expect(3).to_be_less_than(5).passed

    def test_to_be_between(self):
        assert expect(5).to_be_between(1, 10).passed

    def test_to_contain_code(self):
        assert expect("```python\nprint('hi')\n```").to_contain_code().passed

    def test_to_be_professional(self):
        assert expect("Thank you for your inquiry.").to_be_professional().passed

    def test_to_have_proper_grammar(self):
        assert expect("This is a proper sentence.").to_have_proper_grammar().passed
