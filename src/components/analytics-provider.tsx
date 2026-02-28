"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
	const [isInitialized, setIsInitialized] = useState(false);

	useEffect(() => {
		const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
		const host =
			process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

		if (!key) return;

		if (
			navigator.doNotTrack === "1" ||
			(navigator as Record<string, unknown>).globalPrivacyControl
		) {
			return;
		}

		posthog.init(key, {
			api_host: host,
			person_profiles: "identified_only",
			capture_pageview: false,
			capture_pageleave: true,
			autocapture: false,
			persistence: "localStorage+cookie",
			opt_out_capturing_by_default: true,
			respect_dnt: true,
			disable_session_recording: true,
		});

		posthog.opt_in_capturing();
		setIsInitialized(true);
	}, []);

	if (!isInitialized) return <>{children}</>;

	return <PHProvider client={posthog}>{children}</PHProvider>;
}
