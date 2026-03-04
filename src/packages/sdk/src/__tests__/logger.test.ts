import { describe, expect, it } from "vitest";
import { Logger } from "../logger";

describe("Logger.child() prefix formatting", () => {
	it("child(string) should produce correct prefix", () => {
		const entries: { prefix?: string }[] = [];
		const logger = new Logger({
			prefix: "PARENT",
			handler: (e) => entries.push(e),
		});
		const child = logger.child("CHILD");
		child.info("test");
		expect(entries[0].prefix).toBe("PARENT:CHILD");
	});

	it("child({ prefix: 'CHILD' }) should also produce correct prefix", () => {
		const entries: { prefix?: string }[] = [];
		const logger = new Logger({
			prefix: "PARENT",
			handler: (e) => entries.push(e),
		});
		const child = logger.child({ prefix: "CHILD" });
		child.info("test");
		expect(entries[0].prefix).toBe("PARENT:CHILD");
	});

	it("chained children should concatenate prefixes", () => {
		const entries: { prefix?: string }[] = [];
		const logger = new Logger({
			prefix: "A",
			handler: (e) => entries.push(e),
		});
		const child = logger.child("B").child("C");
		child.info("test");
		expect(entries[0].prefix).toBe("A:B:C");
	});
});
