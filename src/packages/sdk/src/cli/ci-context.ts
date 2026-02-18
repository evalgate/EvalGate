/**
 * CI context capture and idempotency key for --onFail import.
 */

import { createHash } from "node:crypto";
import type { CiContext } from "./api";

export function captureCiContext(): CiContext | undefined {
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  const ref = process.env.GITHUB_REF;
  const runId = process.env.GITHUB_RUN_ID;
  const _workflow = process.env.GITHUB_WORKFLOW;
  const _job = process.env.GITHUB_JOB;
  const actor = process.env.GITHUB_ACTOR;

  if (!repo && !sha) return undefined;

  let provider: CiContext["provider"] = "unknown";
  if (process.env.GITHUB_ACTIONS) provider = "github";
  else if (process.env.GITLAB_CI) provider = "gitlab";
  else if (process.env.CIRCLECI) provider = "circle";

  let runUrl: string | undefined;
  if (repo && runId) {
    runUrl = `https://github.com/${repo}/actions/runs/${runId}`;
  }

  return {
    provider,
    repo,
    sha,
    branch: ref?.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref,
    runUrl,
    actor,
  };
}

export function computeIdempotencyKey(evaluationId: string, ci: CiContext): string | undefined {
  const repo = ci.repo ?? process.env.GITHUB_REPOSITORY;
  const workflow = process.env.GITHUB_WORKFLOW ?? "";
  const job = process.env.GITHUB_JOB ?? "";
  const sha = ci.sha ?? process.env.GITHUB_SHA ?? "";

  if (!repo || !sha) return undefined;

  const input = `${repo}.${workflow}.${job}.${sha}.${evaluationId}`;
  return hashSha256(input);
}

function hashSha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
