"use client";
import { createAuthClient } from "better-auth/react";
import { useEffect, useState } from "react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  fetchOptions: {
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get("set-auth-token");
      if (authToken && typeof window !== "undefined") {
        localStorage.setItem("bearer_token", authToken);
      }
    },
    onRequest: (ctx) => {
      try {
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("bearer_token");
          if (token) {
            if (ctx.headers instanceof Headers) {
              ctx.headers.set("Authorization", `Bearer ${token}`);
            } else if (ctx.headers && typeof ctx.headers === "object") {
              (ctx.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            }
          }
        }
      } catch (e) {
        console.error("[auth-client] onRequest error:", e);
      }
      return ctx;
    },
  },
});

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSession = async () => {
    try {
      setIsPending(true);
      // Direct fetch bypasses broken authClient wrapper
      const res = await fetch("/api/auth/get-session", {
        credentials: "include",
        headers: {
          ...(typeof window !== "undefined" && localStorage.getItem("bearer_token")
            ? { Authorization: `Bearer ${localStorage.getItem("bearer_token")}` }
            : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        setError(null);
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error("Session fetch error:", err);
      setSession(null);
      setError(err);
    } finally {
      setIsPending(false);
    }
  };

  const refetch = () => {
    fetchSession();
  };

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { data: session, isPending, error, refetch };
}
