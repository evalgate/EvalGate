import { type NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS: string[] = (() => {
	const origins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
		.split(",")
		.map((o) => o.trim())
		.filter(Boolean);

	if (process.env.NODE_ENV !== "production") {
		for (const dev of ["http://localhost:3000", "http://localhost:3001"]) {
			if (!origins.includes(dev)) origins.push(dev);
		}
	}

	return origins;
})();

export function getCorsHeaders(
	requestOrigin: string | null,
): Record<string, string> {
	if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
		return {};
	}

	return {
		"Access-Control-Allow-Origin": requestOrigin,
		Vary: "Origin",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, Cache-Control",
		"Access-Control-Max-Age": "86400",
	};
}

export function handlePreflight(request: NextRequest): NextResponse {
	const origin = request.headers.get("origin");
	return new NextResponse(null, {
		status: 204,
		headers: getCorsHeaders(origin),
	});
}
