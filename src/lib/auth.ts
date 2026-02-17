import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { NextRequest } from 'next/server';
import { headers } from "next/headers"
import { db } from "@/db";
 
const baseURL =
  process.env.BETTER_AUTH_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const auth = betterAuth({
	baseURL,
	database: drizzleAdapter(db, {
		provider: "sqlite",
	}),
	emailAndPassword: {
		enabled: false
	},
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
		},
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
	trustedOrigins: [
		"http://localhost:3000",
		"https://v0-ai-evaluation-platform-nu.vercel.app",
	],
	plugins: [bearer()],
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		defaultCookieAttributes: {
			// SameSite=None needed for OAuth redirect from Google/GitHub back to app
			sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
			secure: process.env.NODE_ENV === "production",
		},
	},
});

// Session validation helper
export async function getCurrentUser(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user || null;
}
