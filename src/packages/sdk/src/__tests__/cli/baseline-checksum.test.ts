/**
 * Baseline checksum tests
 */
import { describe, expect, it } from "vitest";
import {
	computeBaselineChecksum,
	verifyBaselineChecksum,
} from "../../cli/baseline";

describe("computeBaselineChecksum", () => {
	it("returns a hex string", () => {
		const checksum = computeBaselineChecksum({ foo: "bar" });
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
	});

	it("is deterministic for the same data", () => {
		const data = { a: 1, b: "hello", c: true };
		expect(computeBaselineChecksum(data)).toBe(computeBaselineChecksum(data));
	});

	it("differs when data changes", () => {
		const a = computeBaselineChecksum({ score: 90 });
		const b = computeBaselineChecksum({ score: 91 });
		expect(a).not.toBe(b);
	});

	it("ignores the _checksum field in computation", () => {
		const withoutChecksum = computeBaselineChecksum({ a: 1 });
		const withChecksum = computeBaselineChecksum({
			a: 1,
			_checksum: "should-be-ignored",
		});
		expect(withoutChecksum).toBe(withChecksum);
	});

	it("produces consistent hash regardless of key insertion order", () => {
		const a = computeBaselineChecksum({ x: 1, y: 2 });
		const b = computeBaselineChecksum({ y: 2, x: 1 });
		expect(a).toBe(b);
	});
});

describe("verifyBaselineChecksum", () => {
	it("returns valid=true for data with correct checksum", () => {
		const data: Record<string, unknown> = { score: 90, grade: "A" };
		data._checksum = computeBaselineChecksum(data);
		const result = verifyBaselineChecksum(data);
		expect(result.valid).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	it("returns valid=false for data with incorrect checksum", () => {
		const data: Record<string, unknown> = {
			score: 90,
			_checksum: "deadbeef".repeat(8),
		};
		const result = verifyBaselineChecksum(data);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("Checksum mismatch");
	});

	it("returns valid=true with reason no_checksum for legacy data without checksum", () => {
		const data: Record<string, unknown> = { score: 90 };
		const result = verifyBaselineChecksum(data);
		expect(result.valid).toBe(true);
		expect(result.reason).toBe("no_checksum");
	});
});
