"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function AuthenticatedError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
			<AlertTriangle className="mb-6 h-16 w-16 text-destructive" />
			<h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
				Something went wrong
			</h1>
			<p className="mb-1 text-muted-foreground">
				An unexpected error occurred. Our team has been notified.
			</p>
			{process.env.NODE_ENV === "development" && (
				<pre className="mb-4 mt-2 max-w-lg overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
					{error.message}
				</pre>
			)}
			<div className="mt-6 flex gap-3">
				<button
					type="button"
					onClick={() => reset()}
					className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Try again
				</button>
				<Link
					href="/dashboard"
					className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
				>
					Go to Dashboard
				</Link>
			</div>
		</div>
	);
}
