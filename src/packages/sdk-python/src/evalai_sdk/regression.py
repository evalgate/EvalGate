"""Regression gate constants, types, and helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


class GATE_EXIT:
    PASS = 0
    REGRESSION = 1
    INFRA_ERROR = 2
    CONFIDENCE_FAILED = 3
    CONFIDENCE_MISSING = 4


class GATE_CATEGORY:
    PASS = "pass"
    REGRESSION = "regression"
    INFRA_ERROR = "infra_error"


REPORT_SCHEMA_VERSION = 1


class ARTIFACTS:
    BASELINE = "evals/baseline.json"
    REGRESSION_REPORT = "evals/regression-report.json"
    CONFIDENCE_SUMMARY = "evals/confidence-summary.json"
    LATENCY_BENCHMARK = "evals/latency-benchmark.json"


@dataclass
class BaselineTolerance:
    score_drop: float = 0.05
    latency_increase_pct: float = 20.0
    min_confidence: float = 0.8


@dataclass
class Baseline:
    version: int = REPORT_SCHEMA_VERSION
    scores: dict[str, float] = field(default_factory=dict)
    latencies: dict[str, float] = field(default_factory=dict)
    created_at: str | None = None
    tolerance: BaselineTolerance = field(default_factory=BaselineTolerance)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RegressionDelta:
    test_id: str
    metric: str
    baseline_value: float
    current_value: float
    delta: float
    delta_pct: float
    category: str = GATE_CATEGORY.PASS
    severity: Literal["low", "medium", "high", "critical"] = "low"


@dataclass
class RegressionReport:
    version: int = REPORT_SCHEMA_VERSION
    run_id: str = ""
    gate_exit: int = GATE_EXIT.PASS
    gate_category: str = GATE_CATEGORY.PASS
    deltas: list[RegressionDelta] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)
    created_at: str | None = None


def evaluate_regression(
    baseline: Baseline,
    current_scores: dict[str, float],
) -> RegressionReport:
    """Compare current scores against a baseline and produce a regression report."""
    deltas: list[RegressionDelta] = []
    gate_exit = GATE_EXIT.PASS
    gate_category = GATE_CATEGORY.PASS

    for test_id, baseline_score in baseline.scores.items():
        current = current_scores.get(test_id)
        if current is None:
            continue
        delta = current - baseline_score
        delta_pct = (delta / baseline_score * 100) if baseline_score != 0 else 0

        if delta < -baseline.tolerance.score_drop:
            severity: Literal["low", "medium", "high", "critical"] = "high" if abs(delta_pct) > 20 else "medium"
            deltas.append(
                RegressionDelta(
                    test_id=test_id,
                    metric="score",
                    baseline_value=baseline_score,
                    current_value=current,
                    delta=delta,
                    delta_pct=delta_pct,
                    category=GATE_CATEGORY.REGRESSION,
                    severity=severity,
                )
            )
            gate_exit = GATE_EXIT.REGRESSION
            gate_category = GATE_CATEGORY.REGRESSION
        else:
            deltas.append(
                RegressionDelta(
                    test_id=test_id,
                    metric="score",
                    baseline_value=baseline_score,
                    current_value=current,
                    delta=delta,
                    delta_pct=delta_pct,
                )
            )

    return RegressionReport(
        gate_exit=gate_exit,
        gate_category=gate_category,
        deltas=deltas,
        summary={
            "total": len(deltas),
            "regressions": sum(1 for d in deltas if d.category == GATE_CATEGORY.REGRESSION),
            "passed": sum(1 for d in deltas if d.category == GATE_CATEGORY.PASS),
        },
    )
