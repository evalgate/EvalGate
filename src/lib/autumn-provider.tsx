"use client";
import { AutumnProvider } from "autumn-js/react";
import React from "react";
import { useSession } from "@/lib/auth-client";

export default function CustomAutumnProvider({ children }: { children: React.ReactNode }) {
  const { refetch } = useSession();
  // Capture ?token=... from URL (after checkout redirect), then clear it.
  // Browser auth uses HttpOnly cookies; token query params are not persisted client-side.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) {
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
      // Refresh auth session so user is considered signed in immediately
      Promise.resolve(refetch());
    }
  }, [refetch]);

  return (
    <AutumnProvider includeCredentials={true} getBearerToken={async () => null}>
      {children}
    </AutumnProvider>
  );
}
