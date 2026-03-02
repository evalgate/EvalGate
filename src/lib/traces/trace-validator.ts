/**
 * Trace Validator — Version validation, compatibility checking, and auto-upgrade.
 */

import {
	TRACE_MIN_SUPPORTED_VERSION,
	TRACE_SPEC_VERSION,
	type VersionedSpanUpload,
	type VersionedTraceUpload,
	versionedSpanUploadSchema,
	versionedTraceUploadSchema,
} from "./trace-schema";

export interface ValidationSuccess<T> {
	ok: true;
	data: T;
	upgraded: boolean;
	originalVersion: number;
}

export interface ValidationFailure {
	ok: false;
	error: string;
	code:
		| "VERSION_TOO_OLD"
		| "VERSION_TOO_NEW"
		| "VALIDATION_ERROR"
		| "MISSING_VERSION";
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function validateTraceUpload(
	payload: unknown,
): ValidationResult<VersionedTraceUpload> {
	if (payload == null || typeof payload !== "object") {
		return {
			ok: false,
			error: "Payload must be a non-null object",
			code: "VALIDATION_ERROR",
		};
	}

	const raw = { ...(payload as Record<string, unknown>) };

	if (raw.specVersion === undefined || raw.specVersion === null) {
		raw.specVersion = 1;
	}

	const specVersion = Number(raw.specVersion);

	if (!Number.isInteger(specVersion) || specVersion < 1) {
		return {
			ok: false,
			error: `Invalid specVersion: ${raw.specVersion}`,
			code: "VALIDATION_ERROR",
		};
	}

	if (specVersion < TRACE_MIN_SUPPORTED_VERSION) {
		return {
			ok: false,
			error: `specVersion ${specVersion} no longer supported. Min: ${TRACE_MIN_SUPPORTED_VERSION}`,
			code: "VERSION_TOO_OLD",
		};
	}

	if (specVersion > TRACE_SPEC_VERSION) {
		return {
			ok: false,
			error: `specVersion ${specVersion} newer than server (${TRACE_SPEC_VERSION})`,
			code: "VERSION_TOO_NEW",
		};
	}

	const upgraded = specVersion < TRACE_SPEC_VERSION;
	if (upgraded) raw.specVersion = TRACE_SPEC_VERSION;

	const result = versionedTraceUploadSchema.safeParse(raw);
	if (!result.success) {
		const first = result.error.errors[0];
		return {
			ok: false,
			error: `Validation failed: ${first?.path.join(".")} — ${first?.message}`,
			code: "VALIDATION_ERROR",
		};
	}

	return {
		ok: true,
		data: result.data,
		upgraded,
		originalVersion: specVersion,
	};
}

export function validateSpanUpload(
	payload: unknown,
): ValidationResult<VersionedSpanUpload> {
	if (payload == null || typeof payload !== "object") {
		return {
			ok: false,
			error: "Payload must be a non-null object",
			code: "VALIDATION_ERROR",
		};
	}

	const raw = { ...(payload as Record<string, unknown>) };
	const specVersion =
		raw.specVersion != null ? Number(raw.specVersion) : TRACE_SPEC_VERSION;

	if (!Number.isInteger(specVersion) || specVersion < 1) {
		return {
			ok: false,
			error: `Invalid specVersion: ${raw.specVersion}`,
			code: "VALIDATION_ERROR",
		};
	}

	if (specVersion < TRACE_MIN_SUPPORTED_VERSION) {
		return {
			ok: false,
			error: `specVersion ${specVersion} no longer supported`,
			code: "VERSION_TOO_OLD",
		};
	}

	if (specVersion > TRACE_SPEC_VERSION) {
		return {
			ok: false,
			error: `specVersion ${specVersion} newer than server`,
			code: "VERSION_TOO_NEW",
		};
	}

	const upgraded = specVersion < TRACE_SPEC_VERSION;
	if (upgraded) raw.specVersion = TRACE_SPEC_VERSION;

	const result = versionedSpanUploadSchema.safeParse(raw);
	if (!result.success) {
		const first = result.error.errors[0];
		return {
			ok: false,
			error: `Validation failed: ${first?.path.join(".")} — ${first?.message}`,
			code: "VALIDATION_ERROR",
		};
	}

	return {
		ok: true,
		data: result.data,
		upgraded,
		originalVersion: specVersion,
	};
}

export function isVersionCompatible(specVersion: number): boolean {
	return (
		Number.isInteger(specVersion) &&
		specVersion >= TRACE_MIN_SUPPORTED_VERSION &&
		specVersion <= TRACE_SPEC_VERSION
	);
}
