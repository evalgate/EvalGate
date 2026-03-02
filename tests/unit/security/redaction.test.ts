import { describe, expect, it } from "vitest";
import {
	DEFAULT_REDACTION_PROFILE,
	NO_REDACTION_PROFILE,
	REDACTION_MASK,
	type RedactionProfile,
	redactObject,
	redactString,
	STRICT_REDACTION_PROFILE,
} from "@/lib/security/redaction";

describe("redactObject — PII field matching", () => {
	it("masks email field", () => {
		const { result } = redactObject({ email: "user@example.com" });
		expect(result.email).toBe(REDACTION_MASK);
	});

	it("masks password field", () => {
		const { result } = redactObject({ password: "super-secret-123" });
		expect(result.password).toBe(REDACTION_MASK);
	});

	it("masks apiKey field", () => {
		const { result } = redactObject({
			apiKey: "sk-abcdefghijklmnopqrstuvwxyz",
		});
		expect(result.apiKey).toBe(REDACTION_MASK);
	});

	it("preserves non-PII fields", () => {
		const { result } = redactObject({ message: "hello world", count: 42 });
		expect(result.message).toBe("hello world");
		expect(result.count).toBe(42);
	});

	it("recurses into nested objects", () => {
		const { result } = redactObject({
			user: { email: "u@x.com", name: "Alice" },
		});
		const user = result.user as Record<string, unknown>;
		expect(user.email).toBe(REDACTION_MASK);
		expect(user.name).toBe("Alice");
	});

	it("recurses into arrays of objects", () => {
		const { result } = redactObject({
			messages: [
				{ role: "user", content: "hello" },
				{ role: "assistant", password: "oops" },
			],
		});
		const msgs = result.messages as Record<string, unknown>[];
		expect(msgs[1]!.password).toBe(REDACTION_MASK);
		expect(msgs[0]!.content).toBe("hello");
	});
});

describe("redactObject — secret scanning in string values", () => {
	it("redacts OpenAI key in message content", () => {
		const { result, redactionResult } = redactObject({
			content: "My key is sk-abcdefghijklmnopqrstuvwxyz1234",
		});
		expect(result.content).toContain("[REDACTED]");
		expect(redactionResult.secretsFound).toBeGreaterThan(0);
	});

	it("does not scan strings when secretScanning is off", () => {
		const { result } = redactObject(
			{ content: "My key is sk-abcdefghijklmnopqrstuvwxyz1234" },
			NO_REDACTION_PROFILE,
		);
		expect(result.content).toContain("sk-");
	});
});

describe("redactObject — custom rules", () => {
	it("applies custom rule with mask mode", () => {
		const profile: RedactionProfile = {
			...DEFAULT_REDACTION_PROFILE,
			rules: [{ field: "userId", mode: "mask" }],
		};
		const { result } = redactObject(
			{ userId: "usr-123", name: "Alice" },
			profile,
		);
		expect(result.userId).toBe(REDACTION_MASK);
		expect(result.name).toBe("Alice");
	});

	it("applies custom rule with hash mode", () => {
		const profile: RedactionProfile = {
			...DEFAULT_REDACTION_PROFILE,
			piiFieldMatching: false,
			rules: [{ field: "sessionId", mode: "hash" }],
		};
		const { result } = redactObject({ sessionId: "sess-abcdef" }, profile);
		expect(result.sessionId).toMatch(/\[HASH:[0-9a-f]+\]/);
	});
});

describe("redactObject — result metadata", () => {
	it("reports redacted:true when fields were masked", () => {
		const { redactionResult } = redactObject({ email: "a@b.com" });
		expect(redactionResult.redacted).toBe(true);
		expect(redactionResult.fieldsRedacted).toContain("email");
	});

	it("reports redacted:false for clean object", () => {
		const { redactionResult } = redactObject({ name: "Alice", count: 3 });
		expect(redactionResult.redacted).toBe(false);
	});
});

describe("redactString", () => {
	it("removes API keys from strings", () => {
		const { result, secretsFound } = redactString(
			"token sk-abcdefghijklmnopqrstuvwxyz1234 used",
		);
		expect(result).not.toContain("sk-");
		expect(secretsFound).toBeGreaterThan(0);
	});

	it("returns original when no secrets", () => {
		const { result, secretsFound } = redactString("clean text here");
		expect(result).toBe("clean text here");
		expect(secretsFound).toBe(0);
	});

	it("does not scan when profile has secretScanning off", () => {
		const { result } = redactString(
			"sk-abcdefghijklmnopqrstuvwxyz1234",
			NO_REDACTION_PROFILE,
		);
		expect(result).toContain("sk-");
	});
});

describe("STRICT_REDACTION_PROFILE", () => {
	it("hashes userId", () => {
		const { result } = redactObject(
			{ userId: "user-42" },
			STRICT_REDACTION_PROFILE,
		);
		expect(result.userId).toMatch(/\[HASH:[0-9a-f]+\]/);
	});
});
