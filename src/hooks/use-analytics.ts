"use client";

import posthog from "posthog-js";

type EventName =
	| "evaluation_created"
	| "evaluation_run_started"
	| "trace_viewed"
	| "sdk_initialized"
	| "template_used"
	| "export_shared"
	| "gate_executed"
	| "api_key_created";

export function trackEvent(
	event: EventName,
	properties?: Record<string, unknown>,
) {
	if (typeof window === "undefined") return;
	if (!posthog.__loaded) return;
	posthog.capture(event, properties);
}

export function identifyUser(
	userId: string,
	properties?: Record<string, unknown>,
) {
	if (typeof window === "undefined") return;
	if (!posthog.__loaded) return;
	posthog.identify(userId, properties);
}

export function resetAnalytics() {
	if (typeof window === "undefined") return;
	if (!posthog.__loaded) return;
	posthog.reset();
}
