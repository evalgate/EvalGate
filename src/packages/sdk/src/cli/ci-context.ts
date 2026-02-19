/**
 * CI context capture and idempotency key for --onFail import.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import type { CiContext } from "./api";

function readPrFromEventPath(): number | undefined {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return undefined;
  try {
    const raw = fs.readFileSync(path, "utf8");
    const event = JSON.parse(raw) as { pull_request?: { number?: number } };
    return event.pull_request?.number;
  } catch {
    return undefined;
  }
}

function readPrFromRef(): number | undefined {
  const ref = process.env.GITHUB_REF;
  if (!ref) return undefined;
  const m = ref.match(/^refs\/pull\/(\d+)\/merge$/);
  return m ? parseInt(m[1], 10) : undefined;
}

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

  let pr: number | undefined;
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    pr = readPrFromEventPath() ?? readPrFromRef();
  }

  return {
    provider,
    repo,
    sha,
    branch: ref?.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref,
    runUrl,
    actor,
    pr,
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
