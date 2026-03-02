import { describe, expect, it } from "vitest";
import { TEMPLATE_CATEGORIES } from "@/lib/evaluation-templates/categories";
import {
	COMPREHENSIVE_TEMPLATES,
	getTemplateById,
	getTemplatesByCategory,
} from "@/lib/evaluation-templates/helpers";

// ── COMPREHENSIVE_TEMPLATES ───────────────────────────────────────────────────

describe("COMPREHENSIVE_TEMPLATES", () => {
	it("is a non-empty array", () => {
		expect(Array.isArray(COMPREHENSIVE_TEMPLATES)).toBe(true);
		expect(COMPREHENSIVE_TEMPLATES.length).toBeGreaterThan(0);
	});

	it("every template has an id", () => {
		for (const t of COMPREHENSIVE_TEMPLATES) {
			expect(typeof t.id).toBe("string");
			expect(t.id.length).toBeGreaterThan(0);
		}
	});

	it("every template has a name", () => {
		for (const t of COMPREHENSIVE_TEMPLATES) {
			expect(typeof t.name).toBe("string");
			expect(t.name.length).toBeGreaterThan(0);
		}
	});

	it("every template has a category", () => {
		for (const t of COMPREHENSIVE_TEMPLATES) {
			expect(typeof t.category).toBe("string");
		}
	});

	it("all template IDs are unique", () => {
		const ids = COMPREHENSIVE_TEMPLATES.map((t) => t.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});
});

// ── getTemplatesByCategory ────────────────────────────────────────────────────

describe("getTemplatesByCategory", () => {
	it("returns templates matching the given category", () => {
		// Find a category that has templates
		const firstCategory = COMPREHENSIVE_TEMPLATES[0]!.category;
		const results = getTemplatesByCategory(firstCategory);
		expect(results.length).toBeGreaterThan(0);
		for (const t of results) {
			expect(t.category).toBe(firstCategory);
		}
	});

	it("returns empty array for non-existent category", () => {
		const results = getTemplatesByCategory("__nonexistent_category__");
		expect(results).toHaveLength(0);
	});

	it("all returned templates belong to the requested category", () => {
		const allCategories = [
			...new Set(COMPREHENSIVE_TEMPLATES.map((t) => t.category)),
		];
		for (const cat of allCategories) {
			const results = getTemplatesByCategory(cat);
			for (const t of results) {
				expect(t.category).toBe(cat);
			}
		}
	});

	it("total templates across all categories equals COMPREHENSIVE_TEMPLATES length", () => {
		const allCategories = [
			...new Set(COMPREHENSIVE_TEMPLATES.map((t) => t.category)),
		];
		const total = allCategories.reduce(
			(sum, cat) => sum + getTemplatesByCategory(cat).length,
			0,
		);
		expect(total).toBe(COMPREHENSIVE_TEMPLATES.length);
	});
});

// ── getTemplateById ───────────────────────────────────────────────────────────

describe("getTemplateById", () => {
	it("returns the correct template for a known ID", () => {
		const firstTemplate = COMPREHENSIVE_TEMPLATES[0]!;
		const result = getTemplateById(firstTemplate.id);
		expect(result).toBeDefined();
		expect(result!.id).toBe(firstTemplate.id);
	});

	it("returns undefined for an unknown ID", () => {
		const result = getTemplateById("__this-id-does-not-exist__");
		expect(result).toBeUndefined();
	});

	it("finds every template by its own ID", () => {
		for (const t of COMPREHENSIVE_TEMPLATES) {
			const found = getTemplateById(t.id);
			expect(found?.id).toBe(t.id);
		}
	});
});

// ── TEMPLATE_CATEGORIES ───────────────────────────────────────────────────────

describe("TEMPLATE_CATEGORIES", () => {
	it("is a non-empty array", () => {
		expect(Array.isArray(TEMPLATE_CATEGORIES)).toBe(true);
		expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(0);
	});

	it("every category has id and name", () => {
		for (const cat of TEMPLATE_CATEGORIES) {
			expect(typeof cat.id).toBe("string");
			expect(typeof cat.name).toBe("string");
		}
	});

	it("all category IDs are unique", () => {
		const ids = TEMPLATE_CATEGORIES.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
