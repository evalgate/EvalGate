"use client";
import { createAuthClient } from "better-auth/react";
import { useCallback, useEffect, useState } from "react";
import { logger } from "@/lib/logger";

type SessionUser = {
	id?: string;
	email?: string;
	name?: string;
};

type SessionData = {
	user?: SessionUser;
	[key: string]: unknown;
} | null;

export const authClient = createAuthClient({
	baseURL:
		typeof window !== "undefined"
			? window.location.origin
			: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
});

export function useSession() {
	const [session, setSession] = useState<SessionData>(null);
	const [isPending, setIsPending] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchSession = useCallback(async () => {
		try {
			setIsPending(true);
			const res = await fetch("/api/auth/get-session", {
				credentials: "include",
			});
			if (res.ok) {
				const data: SessionData = await res.json();
				setSession(data);
				setError(null);
			} else {
				setSession(null);
			}
		} catch (err) {
			logger.error("Session fetch error", err);
			setSession(null);
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setIsPending(false);
		}
	}, []);

	const refetch = () => {
		fetchSession();
	};

	useEffect(() => {
		fetchSession();
	}, [fetchSession]);

	return { data: session, isPending, error, refetch };
}
