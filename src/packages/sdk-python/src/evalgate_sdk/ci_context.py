"""CI context auto-detection (T10).

Port of the TypeScript SDK's ``ci-context.ts``.
Detects GitHub Actions, GitLab CI, CircleCI, and other CI providers.
"""

from __future__ import annotations

import contextlib
import os
from dataclasses import dataclass
from typing import Literal

CIProvider = Literal["github", "gitlab", "circle", "azure", "jenkins", "unknown"]


@dataclass
class CIContext:
    provider: CIProvider = "unknown"
    repo: str | None = None
    sha: str | None = None
    branch: str | None = None
    pr: int | None = None
    run_url: str | None = None
    actor: str | None = None
    is_ci: bool = False


def detect_ci_context() -> CIContext:
    """Auto-detect CI provider and extract context from environment variables."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        return _github_context()
    if os.environ.get("GITLAB_CI") == "true":
        return _gitlab_context()
    if os.environ.get("CIRCLECI") == "true":
        return _circle_context()
    if os.environ.get("TF_BUILD") == "true":
        return _azure_context()
    if os.environ.get("JENKINS_URL"):
        return _jenkins_context()
    if any(os.environ.get(k) for k in ("CI", "CONTINUOUS_INTEGRATION", "BUILD_NUMBER")):
        return CIContext(provider="unknown", is_ci=True)
    return CIContext()


def _github_context() -> CIContext:
    ref = os.environ.get("GITHUB_REF", "")
    pr_num = None
    if "/pull/" in ref:
        with contextlib.suppress(ValueError, IndexError):
            pr_num = int(ref.split("/pull/")[1].split("/")[0])

    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    run_url = f"{server}/{repo}/actions/runs/{run_id}" if repo and run_id else None

    return CIContext(
        provider="github",
        repo=repo or None,
        sha=os.environ.get("GITHUB_SHA"),
        branch=os.environ.get("GITHUB_HEAD_REF") or os.environ.get("GITHUB_REF_NAME"),
        pr=pr_num,
        run_url=run_url,
        actor=os.environ.get("GITHUB_ACTOR"),
        is_ci=True,
    )


def _gitlab_context() -> CIContext:
    mr_iid = os.environ.get("CI_MERGE_REQUEST_IID")
    return CIContext(
        provider="gitlab",
        repo=os.environ.get("CI_PROJECT_PATH"),
        sha=os.environ.get("CI_COMMIT_SHA"),
        branch=os.environ.get("CI_COMMIT_REF_NAME"),
        pr=int(mr_iid) if mr_iid else None,
        run_url=os.environ.get("CI_JOB_URL"),
        actor=os.environ.get("GITLAB_USER_LOGIN"),
        is_ci=True,
    )


def _circle_context() -> CIContext:
    pr_num = os.environ.get("CIRCLE_PR_NUMBER")
    return CIContext(
        provider="circle",
        repo=os.environ.get("CIRCLE_PROJECT_REPONAME"),
        sha=os.environ.get("CIRCLE_SHA1"),
        branch=os.environ.get("CIRCLE_BRANCH"),
        pr=int(pr_num) if pr_num else None,
        run_url=os.environ.get("CIRCLE_BUILD_URL"),
        actor=os.environ.get("CIRCLE_USERNAME"),
        is_ci=True,
    )


def _azure_context() -> CIContext:
    pr_id = os.environ.get("SYSTEM_PULLREQUEST_PULLREQUESTID")
    return CIContext(
        provider="azure",
        repo=os.environ.get("BUILD_REPOSITORY_NAME"),
        sha=os.environ.get("BUILD_SOURCEVERSION"),
        branch=os.environ.get("BUILD_SOURCEBRANCH"),
        pr=int(pr_id) if pr_id else None,
        run_url=os.environ.get("SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"),
        actor=os.environ.get("BUILD_REQUESTEDFOR"),
        is_ci=True,
    )


def _jenkins_context() -> CIContext:
    return CIContext(
        provider="jenkins",
        sha=os.environ.get("GIT_COMMIT"),
        branch=os.environ.get("GIT_BRANCH"),
        run_url=os.environ.get("BUILD_URL"),
        actor=os.environ.get("BUILD_USER"),
        is_ci=True,
    )
