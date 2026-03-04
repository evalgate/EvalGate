/**
 * Tests for evalgate init --template
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	AVAILABLE_TEMPLATES,
	installTemplate,
	TEMPLATE_DESCRIPTIONS,
	type TemplateName,
} from "../src/cli/templates";

describe("Templates", () => {
	const testDir = path.join(process.cwd(), ".test-templates");

	beforeEach(() => {
		fs.mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	it("should have 5 available templates", () => {
		expect(AVAILABLE_TEMPLATES).toHaveLength(5);
		expect(AVAILABLE_TEMPLATES).toContain("chatbot");
		expect(AVAILABLE_TEMPLATES).toContain("codegen");
		expect(AVAILABLE_TEMPLATES).toContain("agent");
		expect(AVAILABLE_TEMPLATES).toContain("safety");
		expect(AVAILABLE_TEMPLATES).toContain("rag");
	});

	it("should have descriptions for all templates", () => {
		for (const template of AVAILABLE_TEMPLATES) {
			expect(TEMPLATE_DESCRIPTIONS[template]).toBeDefined();
			expect(TEMPLATE_DESCRIPTIONS[template].length).toBeGreaterThan(0);
		}
	});

	it("should install chatbot template", () => {
		const { filesCreated, filesSkipped } = installTemplate("chatbot", testDir);

		expect(filesCreated.length).toBeGreaterThan(0);
		expect(filesSkipped).toHaveLength(0);

		// Check that eval files were created
		const evalFile = path.join(testDir, "eval", "chatbot-quality.eval.ts");
		expect(fs.existsSync(evalFile)).toBe(true);

		const content = fs.readFileSync(evalFile, "utf-8");
		expect(content).toContain("defineEval");
		expect(content).toContain("createResult");
	});

	it("should install codegen template", () => {
		const { filesCreated } = installTemplate("codegen", testDir);
		expect(filesCreated.length).toBeGreaterThan(0);

		const evalFile = path.join(testDir, "eval", "codegen-quality.eval.ts");
		expect(fs.existsSync(evalFile)).toBe(true);
	});

	it("should install agent template", () => {
		const { filesCreated } = installTemplate("agent", testDir);
		expect(filesCreated.length).toBeGreaterThan(0);

		const evalFile = path.join(testDir, "eval", "agent-tool-use.eval.ts");
		expect(fs.existsSync(evalFile)).toBe(true);
	});

	it("should install safety template", () => {
		const { filesCreated } = installTemplate("safety", testDir);
		expect(filesCreated.length).toBeGreaterThan(0);

		const evalFile = path.join(testDir, "eval", "safety-guards.eval.ts");
		expect(fs.existsSync(evalFile)).toBe(true);
	});

	it("should install rag template", () => {
		const { filesCreated } = installTemplate("rag", testDir);
		expect(filesCreated.length).toBeGreaterThan(0);

		const evalFile = path.join(testDir, "eval", "rag-faithfulness.eval.ts");
		expect(fs.existsSync(evalFile)).toBe(true);
	});

	it("should skip existing files", () => {
		// First install
		installTemplate("chatbot", testDir);

		// Second install should skip
		const { filesCreated, filesSkipped } = installTemplate("chatbot", testDir);
		expect(filesCreated).toHaveLength(0);
		expect(filesSkipped.length).toBeGreaterThan(0);
	});

	it("all templates should contain valid imports", () => {
		for (const template of AVAILABLE_TEMPLATES) {
			const tmpDir = path.join(testDir, template);
			fs.mkdirSync(tmpDir, { recursive: true });
			const { filesCreated } = installTemplate(
				template as TemplateName,
				tmpDir,
			);

			for (const file of filesCreated) {
				if (file.endsWith(".ts")) {
					const content = fs.readFileSync(path.join(tmpDir, file), "utf-8");
					expect(content).toContain("@evalgate/sdk");
					expect(content).toContain("defineEval");
				}
			}
		}
	});
});
