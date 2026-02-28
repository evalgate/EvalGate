/**
 * Import idempotency — same inputs produce same idempotency key.
 * Enables --onFail import to dedupe on CI retries.
 */

import { describe, expect, it } from "vitest";
import { computeIdempotencyKey } from "@/packages/sdk/src/cli/ci-context";

describe("Import idempotency", () => {
	it("computeIdempotencyKey is deterministic for same inputs", () => {
		const ci = {
			provider: "github" as const,
			repo: "owner/repo",
			sha: "abc123",
			branch: "main",
			runUrl: "https://github.com/owner/repo/actions/runs/1",
			actor: "user",
			pr: 42,
		};

		const key1 = computeIdempotencyKey("42", ci);
		const key2 = computeIdempotencyKey("42", ci);

		expect(key1).toBe(key2);
		expect(key1).toBeDefined();
		expect(typeof key1).toBe("string");
		expect(key1?.length).toBe(64);
	});

	it("different evaluationId produces different key", () => {
		const ci = {
			provider: "github" as const,
			repo: "owner/repo",
			sha: "abc123",
			branch: "main",
		};

		const key1 = computeIdempotencyKey("42", ci);
		const key2 = computeIdempotencyKey("43", ci);

		expect(key1).not.toBe(key2);
	});

	it("different sha produces different key", () => {
		const ci1 = {
			provider: "github" as const,
			repo: "owner/repo",
			sha: "abc123",
			branch: "main",
		};
		const ci2 = {
			provider: "github" as const,
			repo: "owner/repo",
			sha: "def456",
			branch: "main",
		};

		const key1 = computeIdempotencyKey("42", ci1);
		const key2 = computeIdempotencyKey("42", ci2);

		expect(key1).not.toBe(key2);
	});
});
