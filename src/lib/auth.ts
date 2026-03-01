import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import type { NextRequest } from "next/server";
import { db } from "@/db";

const baseURL =
	process.env.BETTER_AUTH_BASE_URL ||
	process.env.NEXT_PUBLIC_SITE_URL ||
	(process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: "http://localhost:3000");

export const auth = betterAuth({
	baseURL,
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: false,
	},
	socialProviders: {
		...(process.env.GITHUB_CLIENT_ID &&
			process.env.GITHUB_CLIENT_SECRET && {
				github: {
					clientId: process.env.GITHUB_CLIENT_ID,
					clientSecret: process.env.GITHUB_CLIENT_SECRET,
				},
			}),
		...(process.env.GOOGLE_CLIENT_ID &&
			process.env.GOOGLE_CLIENT_SECRET && {
				google: {
					clientId: process.env.GOOGLE_CLIENT_ID,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET,
				},
			}),
	},
	trustedOrigins: ["http://localhost:3000", "https://evalgate.com"],
	plugins: [bearer()],
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		defaultCookieAttributes: {
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		},
	},
});

// Session validation helper
export async function getCurrentUser(request: NextRequest) {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user || null;
}
