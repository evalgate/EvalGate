import { and, eq, gte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiUsageLogs } from "@/db/schema";
import { validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";

export const GET = secureRoute(async (req: NextRequest, ctx: AuthContext) => {
	const { searchParams } = new URL(req.url);
	const period = searchParams.get("period") || "7d";

	const validPeriods = ["7d", "30d", "90d", "all"];
	if (!validPeriods.includes(period)) {
		return validationError("Invalid period. Must be one of: 7d, 30d, 90d, all");
	}

	const now = new Date();
	const endDate = now.toISOString();
	let startDateStr: string | null = null;
	let startDateObj: Date | null = null;

	if (period !== "all") {
		const daysMap: Record<string, number> = {
			"7d": 7,
			"30d": 30,
			"90d": 90,
		};
		const daysAgo = daysMap[period];
		const start = new Date(now);
		start.setDate(start.getDate() - daysAgo);
		startDateStr = start.toISOString();
		startDateObj = start;
	}

	// Use ctx.organizationId instead of query param
	const whereConditions =
		period === "all"
			? eq(apiUsageLogs.organizationId, ctx.organizationId)
			: and(
					eq(apiUsageLogs.organizationId, ctx.organizationId),
					// biome-ignore lint/style/noNonNullAssertion: safe assertion
					gte(apiUsageLogs.createdAt, startDateObj!),
				);

	const logs = await db.select().from(apiUsageLogs).where(whereConditions);

	if (logs.length === 0) {
		return NextResponse.json({
			summary: {
				totalRequests: 0,
				avgResponseTime: 0,
				minResponseTime: 0,
				maxResponseTime: 0,
				errorRate: 0,
				successRate: 0,
				requestsByStatusCode: {},
				topEndpoints: [],
				requestsOverTime: [],
			},
			period: {
				start: startDateStr,
				end: endDate,
			},
		});
	}

	const totalRequests = logs.length;
	const responseTimes = logs.map((log) => log.responseTimeMs);
	const avgResponseTime = Math.round(
		responseTimes.reduce((a, b) => a + b, 0) / totalRequests,
	);
	const minResponseTime = Math.min(...responseTimes);
	const maxResponseTime = Math.max(...responseTimes);

	const errorCount = logs.filter((log) => log.statusCode >= 400).length;
	const successCount = totalRequests - errorCount;
	const errorRate = parseFloat(((errorCount / totalRequests) * 100).toFixed(2));
	const successRate = parseFloat(
		((successCount / totalRequests) * 100).toFixed(2),
	);

	const statusCodeCounts: Record<string, number> = {};
	logs.forEach((log) => {
		const code = log.statusCode.toString();
		statusCodeCounts[code] = (statusCodeCounts[code] || 0) + 1;
	});

	const requestsByStatusCode: Record<string, number> = {
		"200": statusCodeCounts["200"] || 0,
		"201": statusCodeCounts["201"] || 0,
		"400": statusCodeCounts["400"] || 0,
		"401": statusCodeCounts["401"] || 0,
		"404": statusCodeCounts["404"] || 0,
		"500": statusCodeCounts["500"] || 0,
	};

	const endpointCounts: Record<string, number> = {};
	logs.forEach((log) => {
		endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
	});

	const topEndpoints = Object.entries(endpointCounts)
		.map(([endpoint, count]) => ({ endpoint, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	const dateCounts: Record<string, number> = {};
	logs.forEach((log) => {
		const date =
			log.createdAt instanceof Date
				? log.createdAt.toISOString()
				: String(log.createdAt);
		const dateStr = date.split("T")[0];
		dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
	});

	const requestsOverTime = Object.entries(dateCounts)
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date));

	return NextResponse.json({
		summary: {
			totalRequests,
			avgResponseTime,
			minResponseTime,
			maxResponseTime,
			errorRate,
			successRate,
			requestsByStatusCode,
			topEndpoints,
			requestsOverTime,
		},
		period: {
			start: startDateStr,
			end: endDate,
		},
	});
});
