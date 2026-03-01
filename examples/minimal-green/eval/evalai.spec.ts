/**
 * Minimal evaluation spec for the minimal-green example
 */

import { defineEval } from "@evalgate/sdk";

defineEval({
	name: "Basic Math Operations",
	description: "Test fundamental arithmetic operations",
	prompt:
		"Test basic math operations: 1+1=2, string concatenation, array includes",
	expected: "All tests should pass",
	tags: ["basic", "math", "strings", "arrays"],
	category: "unit-test",
});

defineEval({
	name: "String Operations",
	description: "Test string concatenation and manipulation",
	prompt:
		"Test string concatenation: 'hello' + ' ' + 'world' should equal 'hello world'",
	expected: "String concatenation should work correctly",
	tags: ["basic", "strings"],
	category: "unit-test",
});

defineEval({
	name: "Array Operations",
	description: "Test array includes method",
	prompt: "Test array.includes: [1, 2, 3].includes(2) should return true",
	expected: "Array includes should work correctly",
	tags: ["basic", "arrays"],
	category: "unit-test",
});
