import { beforeEach, describe, expect, it, vi } from "vitest";
import { qualityService } from "@/lib/services/quality.service";

// Mock the database
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
					limit: vi.fn(() => Promise.resolve([])),
				})),
				leftJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve([])),
						})),
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			})),
		})),
	},
}));

describe("Quality Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getQualityLatest", () => {
		it("should return null when no evaluation found", async () => {
			const result = await qualityService.latest(1, 123);
			expect(result).toBeNull();
		});

		it("should return quality score when evaluation exists", async () => {
			const mockDb = await import("@/db");

			// Mock the first query (evaluation check) to return an evaluation
			vi.mocked(mockDb.db.select).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockReturnValueOnce({
						limit: vi
							.fn()
							.mockResolvedValueOnce([{ id: 123, publishedRunId: 456 }]),
					}),
				}),
				// biome-ignore lint/suspicious/noExplicitAny: test mock
			} as any);

			// Mock the second query (quality score) to return a score
			vi.mocked(mockDb.db.select).mockReturnValueOnce({
				from: vi.fn().mockReturnValueOnce({
					where: vi.fn().mockReturnValueOnce({
						orderBy: vi.fn().mockReturnValueOnce({
							limit: vi.fn().mockResolvedValueOnce([
								{
									id: 1,
									evaluationRunId: 100,
									evaluationId: 123,
									organizationId: 1,
									score: 85.5,
									total: 100,
									traceCoverageRate: "0.9",
									provenanceCoverageRate: "0.8",
									breakdown: {},
									flags: {},
									evidenceLevel: "high",
									scoringVersion: "v1.0",
									model: "gpt-4",
									createdAt: "2024-01-01T00:00:00Z",
								},
							]),
						}),
					}),
				}),
				// biome-ignore lint/suspicious/noExplicitAny: test mock
			} as any);

			const result = await qualityService.latest(1, 123);
			expect(result).not.toBeNull();
			expect(result?.score).toBe(85.5);
		});
	});

	describe("getQualityTrend", () => {
		it("should return null when no evaluation found", async () => {
			const result = await qualityService.trend(1, 123);
			expect(result).toBeNull();
		});
	});
});
