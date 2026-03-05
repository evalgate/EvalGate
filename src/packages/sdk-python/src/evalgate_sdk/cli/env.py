"""Centralized environment detection for CLI commands.

Port of ``cli/env.ts``.
"""

from __future__ import annotations

import os
import re


def is_ci() -> bool:
    """Check if running in a CI environment."""
    return bool(
        os.environ.get("GITHUB_ACTIONS")
        or os.environ.get("CI")
        or os.environ.get("CONTINUOUS_INTEGRATION")
        or os.environ.get("BUILDKITE")
        or os.environ.get("CIRCLECI")
        or os.environ.get("TRAVIS")
        or os.environ.get("JENKINS_URL")
    )


def is_github_actions() -> bool:
    """Check if running in GitHub Actions."""
    return os.environ.get("GITHUB_ACTIONS") == "true"


def get_github_step_summary_path() -> str | None:
    """Get GitHub Step Summary path if available."""
    return os.environ.get("GITHUB_STEP_SUMMARY")


_GIT_REF_PATTERN = re.compile(
    r"^(main|master|develop|dev|origin/|remotes/|feature/|hotfix/|release/"
    r"|v\d+\.\d+\.\d+|.*\.\.\..*).*"
)


def is_git_ref(ref: str) -> bool:
    """Check if string looks like a git reference."""
    return bool(_GIT_REF_PATTERN.match(ref))
