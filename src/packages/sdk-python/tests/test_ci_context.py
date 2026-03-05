"""Tests for CI context detection (T10)."""

from __future__ import annotations

from evalgate_sdk.ci_context import detect_ci_context


class TestDetectGitHub:
    def test_github_actions(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_ACTIONS", "true")
        monkeypatch.setenv("GITHUB_REPOSITORY", "user/repo")
        monkeypatch.setenv("GITHUB_SHA", "abc123")
        monkeypatch.setenv("GITHUB_REF_NAME", "main")
        monkeypatch.setenv("GITHUB_ACTOR", "alice")
        monkeypatch.setenv("GITHUB_RUN_ID", "42")
        monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
        monkeypatch.setenv("GITHUB_REF", "refs/heads/main")

        ctx = detect_ci_context()
        assert ctx.provider == "github"
        assert ctx.repo == "user/repo"
        assert ctx.sha == "abc123"
        assert ctx.branch == "main"
        assert ctx.actor == "alice"
        assert ctx.is_ci is True
        assert "actions/runs/42" in (ctx.run_url or "")

    def test_github_pr(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_ACTIONS", "true")
        monkeypatch.setenv("GITHUB_REF", "refs/pull/99/merge")
        monkeypatch.setenv("GITHUB_REPOSITORY", "u/r")
        monkeypatch.setenv("GITHUB_HEAD_REF", "feat-branch")
        ctx = detect_ci_context()
        assert ctx.pr == 99
        assert ctx.branch == "feat-branch"


class TestDetectGitLab:
    def test_gitlab_ci(self, monkeypatch) -> None:
        monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
        monkeypatch.setenv("GITLAB_CI", "true")
        monkeypatch.setenv("CI_PROJECT_PATH", "group/project")
        monkeypatch.setenv("CI_COMMIT_SHA", "def456")
        monkeypatch.setenv("CI_COMMIT_REF_NAME", "develop")
        monkeypatch.setenv("CI_MERGE_REQUEST_IID", "7")
        monkeypatch.setenv("GITLAB_USER_LOGIN", "bob")

        ctx = detect_ci_context()
        assert ctx.provider == "gitlab"
        assert ctx.repo == "group/project"
        assert ctx.pr == 7


class TestDetectCircle:
    def test_circleci(self, monkeypatch) -> None:
        monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
        monkeypatch.delenv("GITLAB_CI", raising=False)
        monkeypatch.setenv("CIRCLECI", "true")
        monkeypatch.setenv("CIRCLE_PROJECT_REPONAME", "myrepo")
        monkeypatch.setenv("CIRCLE_SHA1", "ghi789")
        monkeypatch.setenv("CIRCLE_BRANCH", "feature")
        monkeypatch.setenv("CIRCLE_BUILD_URL", "https://circleci.com/build/1")

        ctx = detect_ci_context()
        assert ctx.provider == "circle"
        assert ctx.sha == "ghi789"


class TestDetectNone:
    def test_no_ci(self, monkeypatch) -> None:
        for var in (
            "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "TF_BUILD", 
            "JENKINS_URL", "CI", "CONTINUOUS_INTEGRATION", "BUILD_NUMBER"
        ):
            monkeypatch.delenv(var, raising=False)
        ctx = detect_ci_context()
        assert ctx.is_ci is False
        assert ctx.provider == "unknown"

    def test_generic_ci(self, monkeypatch) -> None:
        for var in ("GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "TF_BUILD", "JENKINS_URL"):
            monkeypatch.delenv(var, raising=False)
        monkeypatch.setenv("CI", "true")
        ctx = detect_ci_context()
        assert ctx.is_ci is True
        assert ctx.provider == "unknown"
