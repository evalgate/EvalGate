"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Intermediate page after OAuth callback.
 * Allows the session cookie to be fully established before redirecting to the final destination.
 * The client-side redirect ensures the cookie is sent with the dashboard request.
 */
export default function CallbackSuccessPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    // Validate redirect is same-origin path to prevent open redirect
    const safePath =
      redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
    window.location.replace(safePath);
  }, [redirectTo]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
