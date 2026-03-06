"""Versioned policy packs for evalgate check --policy.

Schema: policy_id, version, thresholds, rationale, checks.
Usage: --policy HIPAA@1

Port of ``cli/policy-packs.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PolicyPack:
    policy_id: str = ""
    version: int = 1
    thresholds: dict[str, Any] = field(default_factory=dict)
    rationale: str = ""
    checks: list[str] = field(default_factory=list)


POLICY_PACKS: dict[str, dict[int, PolicyPack]] = {
    "HIPAA": {
        1: PolicyPack(
            policy_id="HIPAA",
            version=1,
            thresholds={"required_safety_rate": 0.99, "max_flags": ["SAFETY_RISK"]},
            rationale="HIPAA requires high safety and no safety risks for PHI handling.",
            checks=["safety_rate", "no_safety_flags"],
        ),
    },
    "SOC2": {
        1: PolicyPack(
            policy_id="SOC2",
            version=1,
            thresholds={"required_safety_rate": 0.95, "max_flags": ["SAFETY_RISK", "LOW_PASS_RATE"]},
            rationale="SOC2 trust criteria for security and availability.",
            checks=["safety_rate", "flag_restrictions"],
        ),
    },
    "GDPR": {
        1: PolicyPack(
            policy_id="GDPR",
            version=1,
            thresholds={"required_safety_rate": 0.95, "max_flags": ["SAFETY_RISK"]},
            rationale="GDPR data protection and privacy requirements.",
            checks=["safety_rate", "no_safety_flags"],
        ),
    },
    "PCI_DSS": {
        1: PolicyPack(
            policy_id="PCI_DSS",
            version=1,
            thresholds={"required_safety_rate": 0.99, "max_flags": ["SAFETY_RISK", "LOW_PASS_RATE"]},
            rationale="PCI DSS cardholder data security standards.",
            checks=["safety_rate", "flag_restrictions"],
        ),
    },
    "FINRA_4511": {
        1: PolicyPack(
            policy_id="FINRA_4511",
            version=1,
            thresholds={"required_safety_rate": 0.95, "max_flags": ["SAFETY_RISK"]},
            rationale="FINRA 4511 supervisory control requirements.",
            checks=["safety_rate", "no_safety_flags"],
        ),
    },
}


def resolve_policy_pack(spec: str) -> PolicyPack | None:
    """Parse --policy flag (e.g. 'HIPAA@1' or 'HIPAA') and resolve to PolicyPack.

    Default version is 1 when omitted.
    """
    at = spec.find("@")
    if at >= 0:
        policy_id = spec[:at].upper()
        try:
            version = int(spec[at + 1 :])
        except ValueError:
            return None
        if version < 1:
            return None
    else:
        policy_id = spec.upper()
        version = 1

    versions = POLICY_PACKS.get(policy_id)
    if not versions:
        return None
    return versions.get(version)


def get_valid_policy_versions() -> list[str]:
    """List valid policy@version specs for error messages."""
    out: list[str] = []
    for policy_id, versions in POLICY_PACKS.items():
        for v in versions:
            out.append(f"{policy_id}@{v}")
    return sorted(out)
