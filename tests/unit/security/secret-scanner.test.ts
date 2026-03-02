import { describe, expect, it } from "vitest";
import {
	containsSecret,
	listPatternNames,
	scanForSecrets,
} from "@/lib/security/secret-scanner";

describe("scanForSecrets", () => {
	it("detects OpenAI API key", () => {
		const result = scanForSecrets(
			"Using key sk-abcdefghijklmnopqrstuvwxyz1234 for call",
		);
		expect(result.found).toBe(true);
		expect(result.count).toBeGreaterThan(0);
		expect(result.redacted).toContain("[REDACTED]");
		expect(result.redacted).not.toContain("sk-");
	});

	it("detects Bearer token", () => {
		const result = scanForSecrets(
			"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
		);
		expect(result.found).toBe(true);
		expect(result.redacted).not.toContain("Bearer eyJ");
	});

	it("detects JWT token", () => {
		const jwt =
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
		const result = scanForSecrets(`Token is: ${jwt}`);
		expect(result.found).toBe(true);
	});

	it("detects Anthropic API key", () => {
		const result = scanForSecrets("key=sk-ant-api03-AAAABBBBCCCCDDDDEEEE");
		expect(result.found).toBe(true);
	});

	it("detects AWS access key", () => {
		const result = scanForSecrets("AKIAIOSFODNN7EXAMPLE is the access key");
		expect(result.found).toBe(true);
	});

	it("detects GitHub token", () => {
		const result = scanForSecrets(
			"token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
		);
		expect(result.found).toBe(true);
	});

	it("returns original string if no secrets found", () => {
		const input = "This is a totally normal string with no secrets.";
		const result = scanForSecrets(input);
		expect(result.found).toBe(false);
		expect(result.count).toBe(0);
		expect(result.redacted).toBe(input);
	});

	it("handles empty string", () => {
		const result = scanForSecrets("");
		expect(result.found).toBe(false);
		expect(result.redacted).toBe("");
	});

	it("replaces multiple secrets in one string", () => {
		const input =
			"key1=sk-abcdefghijklmnopqrstuvwxyz1234 and key2=sk-zzzzzzzzzzzzzzzzzzzzzzzzzz5678";
		const result = scanForSecrets(input);
		expect(result.found).toBe(true);
		expect(result.redacted).not.toContain("sk-");
	});

	it("detects database connection string with credentials", () => {
		const result = scanForSecrets(
			"postgresql://user:mysecretpassword@localhost:5432/mydb",
		);
		expect(result.found).toBe(true);
		expect(result.redacted).not.toContain("mysecretpassword");
	});
});

describe("containsSecret", () => {
	it("returns true for string with API key", () => {
		expect(containsSecret("sk-abcdefghijklmnopqrstuvwxyz1234")).toBe(true);
	});

	it("returns false for clean string", () => {
		expect(containsSecret("hello world")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(containsSecret("")).toBe(false);
	});
});

describe("listPatternNames", () => {
	it("returns an array of pattern names", () => {
		const names = listPatternNames();
		expect(names.length).toBeGreaterThan(0);
		expect(names).toContain("openai-api-key");
		expect(names).toContain("bearer-token");
		expect(names).toContain("jwt");
	});
});
