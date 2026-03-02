import { describe, expect, it } from "vitest";
import {
	COMPAT_WINDOW,
	checkCompat,
	formatCompatMatrix,
	getContractTestVersions,
	getSupportedRange,
	isCompatible,
} from "@/lib/reliability/compat";

describe("checkCompat", () => {
	it("accepts exact current version with no upgrade needed", () => {
		const result = checkCompat(3, 3);
		expect(result.compatible).toBe(true);
		if (result.compatible) {
			expect(result.needsUpgrade).toBe(false);
			expect(result.fromVersion).toBe(3);
			expect(result.toVersion).toBe(3);
		}
	});

	it("accepts one version behind (within window)", () => {
		const result = checkCompat(2, 3);
		expect(result.compatible).toBe(true);
		if (result.compatible) {
			expect(result.needsUpgrade).toBe(true);
		}
	});

	it("rejects version too old", () => {
		const result = checkCompat(1, 3);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.code).toBe("TOO_OLD");
		}
	});

	it("rejects version newer than server", () => {
		const result = checkCompat(4, 3);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.code).toBe("TOO_NEW");
		}
	});

	it("rejects non-integer specVersion", () => {
		const result = checkCompat(0, 3);
		expect(result.compatible).toBe(false);
		if (!result.compatible) {
			expect(result.code).toBe("INVALID");
		}
	});

	it("accepts custom window size", () => {
		expect(checkCompat(1, 3, 3).compatible).toBe(true);
		expect(checkCompat(1, 3, 2).compatible).toBe(false);
	});

	it("always accepts v1 when server is v1", () => {
		expect(checkCompat(1, 1).compatible).toBe(true);
	});
});

describe("isCompatible", () => {
	it("returns true for compatible versions", () => {
		expect(isCompatible(2, 3)).toBe(true);
		expect(isCompatible(3, 3)).toBe(true);
	});

	it("returns false for incompatible versions", () => {
		expect(isCompatible(1, 3)).toBe(false);
		expect(isCompatible(5, 3)).toBe(false);
	});
});

describe("getSupportedRange", () => {
	it("returns min = max - window + 1", () => {
		const range = getSupportedRange(3, 2);
		expect(range.min).toBe(2);
		expect(range.max).toBe(3);
	});

	it("clamps min to 1", () => {
		const range = getSupportedRange(2, 10);
		expect(range.min).toBe(1);
	});
});

describe("formatCompatMatrix", () => {
	it("formats correct matrix string", () => {
		const matrix = formatCompatMatrix(3, 2);
		expect(matrix).toBe("Server v3 accepts client versions: v2, v3");
	});

	it("handles server v1", () => {
		const matrix = formatCompatMatrix(1, 2);
		expect(matrix).toBe("Server v1 accepts client versions: v1");
	});
});

describe("getContractTestVersions", () => {
	it("returns all versions in window", () => {
		const versions = getContractTestVersions(3, 2);
		expect(versions).toEqual([2, 3]);
	});

	it("starts from v1 if window exceeds range", () => {
		const versions = getContractTestVersions(2, 5);
		expect(versions).toEqual([1, 2]);
	});
});
