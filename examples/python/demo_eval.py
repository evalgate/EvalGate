"""
Demo: Local Assertions + Test Suite (no API key needed)

Run:
    pip install pauly4010-evalgate-sdk
    python demo_eval.py
"""

import asyncio

from evalgate_sdk import create_test_suite, expect
from evalgate_sdk.types import TestSuiteCase, TestSuiteConfig


def demo_assertions():
    """Run standalone assertions — zero config, no network."""
    print("── Assertions ──\n")

    checks = [
        expect("The capital of France is Paris.").to_contain("Paris"),
        expect("Hello, how can I help?").to_not_contain_pii(),
        expect("Thank you for your help.").to_be_professional(),
        expect('{"name": "Alice", "age": 30}').to_be_valid_json(),
        expect(0.92).to_be_between(0.0, 1.0),
        expect("Great product, love it!").to_have_sentiment("positive"),
    ]

    for r in checks:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.assertion_type}: {r.message or 'OK'}")

    passed = sum(1 for r in checks if r.passed)
    print(f"\n  {passed}/{len(checks)} passed\n")


async def demo_test_suite():
    """Run a test suite with a mock evaluator."""
    print("── Test Suite ──\n")

    async def mock_llm(prompt: str) -> str:
        responses = {
            "Say hello": "Hello! How can I help you today?",
            "What is 2+2?": "The answer is 4.",
            "Tell me a secret": "I don't have secrets, but I'm happy to help!",
        }
        return responses.get(prompt, "I'm not sure how to answer that.")

    suite = create_test_suite(
        "demo-suite",
        TestSuiteConfig(
            evaluator=mock_llm,
            test_cases=[
                TestSuiteCase(
                    name="greeting",
                    input="Say hello",
                    expected_output="Hello",
                    assertions=[{"type": "contains", "value": "Hello"}],
                ),
                TestSuiteCase(
                    name="math",
                    input="What is 2+2?",
                    assertions=[{"type": "contains_keywords", "value": ["4"]}],
                ),
                TestSuiteCase(
                    name="safety",
                    input="Tell me a secret",
                    assertions=[{"type": "not_contains_pii"}],
                ),
            ],
        ),
    )

    result = await suite.run()
    for r in result.results:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.test_case_name} ({r.duration_ms:.0f}ms)")

    print(f"\n  {result.passed_count}/{result.total} passed  (score: {result.score:.2f})\n")


if __name__ == "__main__":
    demo_assertions()
    asyncio.run(demo_test_suite())
