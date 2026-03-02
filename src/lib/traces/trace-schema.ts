/**
 * Trace Schema — Versioned behavioral record schema for production traces.
 *
 * TRACE_SPEC_VERSION is the single source of truth for trace compatibility.
 * The server rejects incompatible uploads and auto-upgrades older (but
 * supported) traces when possible.
 */

import { z } from "zod";

// ── Version constants ────────────────────────────────────────────────────────

export const TRACE_SPEC_VERSION = 1;
export const TRACE_MIN_SUPPORTED_VERSION = 1;

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const messageRecordSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool", "function"]),
	content: z.string(),
	name: z.string().optional(),
	toolCallId: z.string().optional(),
	timestamp: z.string().optional(),
});

export const reasoningSegmentSchema = z.object({
	stepIndex: z.number().int().min(0),
	type: z.enum([
		"chain_of_thought",
		"reflection",
		"planning",
		"tool_selection",
		"self_critique",
		"summarization",
		"custom",
	]),
	content: z.string(),
	confidence: z.number().min(0).max(1).optional(),
});

export const toolCallRecordSchema = z.object({
	name: z.string(),
	arguments: z.record(z.unknown()),
	output: z.unknown().optional(),
	success: z.boolean().optional(),
	durationMs: z.number().int().min(0).optional(),
	timestamp: z.string().optional(),
});

export const retrievedDocumentSchema = z.object({
	documentId: z.string(),
	score: z.number().min(0).max(1).optional(),
	source: z.string().optional(),
	content: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
});

export const environmentMetadataSchema = z.object({
	runtime: z.string().optional(),
	runtimeVersion: z.string().optional(),
	sdkName: z.string().optional(),
	sdkVersion: z.string().optional(),
	deployEnvironment: z.string().optional(),
	commitSha: z.string().optional(),
	branch: z.string().optional(),
	serviceName: z.string().optional(),
	region: z.string().optional(),
	custom: z.record(z.unknown()).optional(),
});

export const behavioralSpanPayloadSchema = z.object({
	messages: z.array(messageRecordSchema).optional(),
	reasoningSegments: z.array(reasoningSegmentSchema).optional(),
	toolCalls: z.array(toolCallRecordSchema).optional(),
	retrievedDocuments: z.array(retrievedDocumentSchema).optional(),
	error: z
		.object({
			message: z.string(),
			code: z.string().optional(),
			stack: z.string().optional(),
		})
		.optional(),
});

// ── Versioned trace upload schema ────────────────────────────────────────────

export const versionedTraceUploadSchema = z.object({
	specVersion: z.number().int().min(1),
	traceId: z.string().min(1).max(255),
	name: z.string().min(1).max(255),
	status: z.enum(["pending", "success", "error"]).optional(),
	durationMs: z.number().int().min(0).optional().nullable(),
	environment: environmentMetadataSchema.optional(),
	metadata: z.record(z.unknown()).optional().nullable(),
});

// ── Versioned span upload schema ─────────────────────────────────────────────

export const versionedSpanUploadSchema = z.object({
	specVersion: z.number().int().min(1).optional(),
	spanId: z.string().min(1),
	name: z.string().min(1),
	type: z.string().min(1),
	parentSpanId: z.string().optional(),
	input: z.unknown().optional(),
	output: z.unknown().optional(),
	durationMs: z.number().int().min(0).optional().nullable(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	evaluationRunId: z.number().int().positive().optional().nullable(),
	metadata: z.unknown().optional(),
	behavioral: behavioralSpanPayloadSchema.optional(),
});

// ── Inferred types ───────────────────────────────────────────────────────────

export type MessageRecord = z.infer<typeof messageRecordSchema>;
export type ReasoningSegment = z.infer<typeof reasoningSegmentSchema>;
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>;
export type RetrievedDocument = z.infer<typeof retrievedDocumentSchema>;
export type EnvironmentMetadata = z.infer<typeof environmentMetadataSchema>;
export type BehavioralSpanPayload = z.infer<typeof behavioralSpanPayloadSchema>;
export type VersionedTraceUpload = z.infer<typeof versionedTraceUploadSchema>;
export type VersionedSpanUpload = z.infer<typeof versionedSpanUploadSchema>;
