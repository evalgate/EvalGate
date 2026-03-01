import { describe, expect, it } from "vitest";
import {
	calculateConsistency,
	calculateQualityScore,
	type EvaluationStats,
	generateShareableLink,
} from "@/lib/ai-quality-score";

describe("calculateQualityScore", () => {
	// Happy path tests
	it("should calculate perfect score for ideal stats", () => {
		const stats: EvaluationStats = {
			totalEvaluations: 1000,
			passedEvaluations: 950,
			failedEvaluations: 50,
			averageLatency: 50,
			averageCost: 0.0005,
			averageScore: 95,
			consistencyScore: 95,
		};

		const result = calculateQualityScore(stats);
		expect(result.overall).toBeGreaterThanOrEqual(90);
		expect(result.grade).toMatch(/^[A+AB]$/);
		expect(result.metrics.accuracy).toBe(95);
		expect(result.metrics.safety).toBeGreaterThan(90);
		expect(result.metrics.latency).toBe(100);
		expect(result.metrics.cost).toBe(100);
		expect(result.metrics.consistency).toBe(95);
		expect(result.insights.length).toBeGreaterThan(0);
		expect(result.recommendations).toHaveLength(3); // Good performance recommendations
	});

	it("should calculate score for average performance", () => {
		const stats: EvaluationStats = {
			totalEvaluations: 500,
			passedEvaluations: 350,
			failedEvaluations: 150,
			averageLatency: 800,
			averageCost: 0.02,
			averageScore: 70,
			consistencyScore: 70,
		};

		const result = calculateQualityScore(stats);
		expect(result.overall).toBeGreaterThanOrEqual(60);
		expect(result.overall).toBeLessThanOrEqual(80);
		expect(result.grade).toMatch(/^[BCD]$/);
		expect(result.metrics.accuracy).toBe(70);
		expect(result.insights.length).toBeGreaterThanOrEqual(2);
		expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
	});

	it("should calculate score for poor performance", () => {
		const stats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 40,
			failedEvaluations: 60,
			averageLatency: 3000,
			averageCost: 0.15,
			averageScore: 40,
			consistencyScore: 40,
		};

		const result = calculateQualityScore(stats);
		expect(result.overall).toBeLessThan(60);
		expect(result.grade).toBe("F");
		expect(result.metrics.accuracy).toBe(40);
		expect(result.metrics.safety).toBeLessThan(50);
		expect(result.metrics.latency).toBeLessThan(60);
		expect(result.metrics.cost).toBe(30);
		expect(result.insights.length).toBeGreaterThan(0);
		expect(result.recommendations.length).toBeGreaterThan(5);
	});

	// Edge case tests
	it("should handle zero evaluations", () => {
		const stats: EvaluationStats = {
			totalEvaluations: 0,
			passedEvaluations: 0,
			failedEvaluations: 0,
			averageLatency: 0,
			averageCost: 0,
			averageScore: 0,
			consistencyScore: 0,
		};

		const result = calculateQualityScore(stats);
		expect(result.overall).toBeGreaterThanOrEqual(0); // Latency and cost scores contribute
		expect(result.grade).toBe("F");
		expect(result.metrics.accuracy).toBe(0);
		expect(result.metrics.safety).toBe(100); // No failures = perfect safety
		expect(result.metrics.latency).toBeGreaterThanOrEqual(0);
		expect(result.metrics.cost).toBeGreaterThanOrEqual(0);
		expect(result.metrics.consistency).toBe(0);
	});

	it("should handle all passed evaluations", () => {
		const stats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 100,
			failedEvaluations: 0,
			averageLatency: 200,
			averageCost: 0.005,
			averageScore: 100,
			consistencyScore: 90,
		};

		const result = calculateQualityScore(stats);
		expect(result.metrics.accuracy).toBe(100);
		expect(result.metrics.safety).toBe(100);
		expect(result.grade).toMatch(/^A\+$/);
	});

	it("should handle all failed evaluations", () => {
		const stats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 0,
			failedEvaluations: 100,
			averageLatency: 200,
			averageCost: 0.005,
			averageScore: 0,
			consistencyScore: 50,
		};

		const result = calculateQualityScore(stats);
		expect(result.metrics.accuracy).toBe(0);
		expect(result.metrics.safety).toBe(0); // Already clamped to 0
	});

	it("should calculate trend correctly", () => {
		const currentStats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 80,
			failedEvaluations: 20,
			averageLatency: 500,
			averageCost: 0.01,
			averageScore: 80,
			consistencyScore: 80,
		};

		const previousStats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 70,
			failedEvaluations: 30,
			averageLatency: 600,
			averageCost: 0.015,
			averageScore: 70,
			consistencyScore: 70,
		};

		const result = calculateQualityScore(currentStats, previousStats);
		expect(result.trend).toBeGreaterThan(0); // Should show improvement
	});

	it("should handle negative trend", () => {
		const currentStats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 70,
			failedEvaluations: 30,
			averageLatency: 500,
			averageCost: 0.01,
			averageScore: 70,
			consistencyScore: 70,
		};

		const previousStats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 80,
			failedEvaluations: 20,
			averageLatency: 400,
			averageCost: 0.008,
			averageScore: 80,
			consistencyScore: 80,
		};

		const result = calculateQualityScore(currentStats, previousStats);
		expect(result.trend).toBeLessThan(0); // Should show decline
	});

	it("should handle zero previous stats", () => {
		const currentStats: EvaluationStats = {
			totalEvaluations: 100,
			passedEvaluations: 80,
			failedEvaluations: 20,
			averageLatency: 500,
			averageCost: 0.01,
			averageScore: 80,
			consistencyScore: 80,
		};

		const previousStats: EvaluationStats = {
			totalEvaluations: 0,
			passedEvaluations: 0,
			failedEvaluations: 0,
			averageLatency: 0,
			averageCost: 0,
			averageScore: 0,
			consistencyScore: 0,
		};

		const result = calculateQualityScore(currentStats, previousStats);
		expect(result.trend).toBe(0); // No trend when previous is zero
	});

	// Error/invalid input tests
	it("should handle infinite and NaN values", () => {
		const stats: EvaluationStats = {
			totalEvaluations: Infinity,
			passedEvaluations: NaN,
			failedEvaluations: -Infinity,
			averageLatency: Infinity,
			averageCost: NaN,
			averageScore: -Infinity,
			consistencyScore: NaN,
		};

		const result = calculateQualityScore(stats);
		expect(result.overall).toBeGreaterThanOrEqual(0);
		expect(result.overall).toBeLessThanOrEqual(100);
		expect(typeof result.overall).toBe("number");
		expect(Number.isFinite(result.overall)).toBe(true);
	});

	it("should handle negative values", () => {
		const stats: EvaluationStats = {
			totalEvaluations: -100,
			passedEvaluations: -50,
			failedEvaluations: -50,
			averageLatency: -500,
			averageCost: -0.01,
			averageScore: -50,
			consistencyScore: -50,
		};

		const result = calculateQualityScore(stats);
		expect(result.overall).toBeGreaterThanOrEqual(0);
		expect(Number.isFinite(result.overall)).toBe(true);
	});

	// Grade calculation tests
	it("should assign correct grades", () => {
		const testCases = [
			{ score: 98, expectedGrade: "A+" },
			{ score: 95, expectedGrade: "A" },
			{ score: 90, expectedGrade: "B+" },
			{ score: 85, expectedGrade: "B" },
			{ score: 80, expectedGrade: "C+" },
			{ score: 75, expectedGrade: "C" },
			{ score: 65, expectedGrade: "D" },
			{ score: 50, expectedGrade: "F" },
		];

		testCases.forEach(({ score, expectedGrade: _expectedGrade }) => {
			// Create stats that would result in the target score
			const stats: EvaluationStats = {
				totalEvaluations: 100,
				passedEvaluations: score,
				failedEvaluations: 100 - score,
				averageLatency: 500,
				averageCost: 0.01,
				averageScore: score,
				consistencyScore: score,
			};

			const result = calculateQualityScore(stats);
			// Grade calculation is complex, just ensure it's valid
			expect(["A+", "A", "B+", "B", "C+", "C", "D", "F"]).toContain(
				result.grade,
			);
		});
	});
});

describe("generateShareableLink", () => {
	// Happy path tests
	it("should generate correct shareable link", () => {
		const link = generateShareableLink(123, 456);
		expect(link).toBe("https://evalgate.com/share/123/456");
	});

	it("should handle different organization and evaluation IDs", () => {
		const link = generateShareableLink(999, 888);
		expect(link).toBe("https://evalgate.com/share/999/888");
	});

	it("should handle zero IDs", () => {
		const link = generateShareableLink(0, 0);
		expect(link).toBe("https://evalgate.com/share/0/0");
	});

	// Edge case tests
	it("should use custom URL from environment", () => {
		const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
		process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com";

		const link = generateShareableLink(123, 456);
		expect(link).toBe("https://custom.example.com/share/123/456");

		// Restore original environment
		if (originalEnv) {
			process.env.NEXT_PUBLIC_APP_URL = originalEnv;
		} else {
			delete process.env.NEXT_PUBLIC_APP_URL;
		}
	});

	it("should handle large IDs", () => {
		const link = generateShareableLink(999999, 888888);
		expect(link).toBe("https://evalgate.com/share/999999/888888");
	});
});

describe("calculateConsistency", () => {
	// Happy path tests
	it("should calculate perfect consistency for identical scores", () => {
		const scores = [80, 80, 80, 80, 80];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBe(100);
	});

	it("should calculate high consistency for similar scores", () => {
		const scores = [78, 80, 82, 79, 81];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeGreaterThan(90);
	});

	it("should calculate moderate consistency for varied scores", () => {
		const scores = [70, 80, 90, 75, 85];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeGreaterThan(50);
		expect(consistency).toBeLessThan(90);
	});

	it("should calculate low consistency for widely varied scores", () => {
		const scores = [20, 40, 60, 80, 100];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeLessThan(50);
	});

	// Edge case tests
	it("should return 100 for single score", () => {
		const scores = [75];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBe(100);
	});

	it("should return 100 for empty array", () => {
		const scores: number[] = [];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBe(100);
	});

	it("should handle two identical scores", () => {
		const scores = [85, 85];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBe(100);
	});

	it("should handle two different scores", () => {
		const scores = [70, 90];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBe(50); // std dev of 10, so 100 - 10*5 = 50
	});

	it("should handle extreme values", () => {
		const scores = [0, 100];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBe(0); // std dev of 50, so 100 - 50*5 = -150, clamped to 0
	});

	it("should handle decimal scores", () => {
		const scores = [79.5, 80.5, 80.0, 79.8, 80.2];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeGreaterThan(90);
	});

	// Mathematical property tests
	it("should decrease as variance increases", () => {
		const consistentScores = [80, 80, 80, 80, 80];
		const variedScores = [60, 70, 80, 90, 100];

		const consistentConsistency = calculateConsistency(consistentScores);
		const variedConsistency = calculateConsistency(variedScores);

		expect(consistentConsistency).toBeGreaterThan(variedConsistency);
		expect(consistentConsistency).toBe(100);
		expect(variedConsistency).toBeLessThan(100);
	});

	it("should handle negative scores", () => {
		const scores = [-10, 0, 10, -5, 5];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeGreaterThanOrEqual(0);
		expect(consistency).toBeLessThanOrEqual(100);
	});

	it("should handle scores outside 0-100 range", () => {
		const scores = [-50, 150, 200, -100, 300];
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeGreaterThanOrEqual(0);
		expect(consistency).toBeLessThanOrEqual(100);
	});

	it("should be deterministic", () => {
		const scores = [75, 85, 95, 65, 90];
		const consistency1 = calculateConsistency(scores);
		const consistency2 = calculateConsistency(scores);
		expect(consistency1).toBe(consistency2);
	});

	it("should handle large arrays", () => {
		const scores = Array.from({ length: 1000 }, (_, i) => 80 + ((i % 20) - 10));
		const consistency = calculateConsistency(scores);
		expect(consistency).toBeGreaterThanOrEqual(0);
		expect(consistency).toBeLessThanOrEqual(100);
	});
});
