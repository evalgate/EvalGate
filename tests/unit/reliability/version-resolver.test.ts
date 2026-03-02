import { beforeEach, describe, expect, it } from "vitest";
import {
	createReliabilityObject,
	ReliabilityObjectType,
} from "@/lib/reliability/reliability-object";
import { VersionResolver } from "@/lib/reliability/version-resolver";

function makeEntity(id: string, version: number, isoDate: string) {
	const reliability = createReliabilityObject({
		id,
		type: ReliabilityObjectType.METRIC,
		source: "test",
	});
	return {
		id,
		type: ReliabilityObjectType.METRIC,
		version,
		createdAt: isoDate,
		data: { value: version },
		reliability: { ...reliability, version },
	};
}

describe("VersionResolver", () => {
	let resolver: VersionResolver;

	beforeEach(() => {
		resolver = new VersionResolver();
	});

	it("resolves by exact version", () => {
		resolver.register(makeEntity("m-1", 1, "2024-01-01T00:00:00Z"));
		resolver.register(makeEntity("m-1", 2, "2024-02-01T00:00:00Z"));

		const result = resolver.resolveByVersion({ entityId: "m-1", version: 1 });
		expect(result.found).toBe(true);
		if (result.found) expect(result.entity.version).toBe(1);
	});

	it("returns not found for missing entity", () => {
		const result = resolver.resolveByVersion({ entityId: "ghost", version: 1 });
		expect(result.found).toBe(false);
	});

	it("returns not found for missing version", () => {
		resolver.register(makeEntity("m-1", 1, "2024-01-01T00:00:00Z"));
		const result = resolver.resolveByVersion({ entityId: "m-1", version: 99 });
		expect(result.found).toBe(false);
	});

	it("resolves by timestamp to latest version at or before", () => {
		resolver.register(makeEntity("m-1", 1, "2024-01-01T00:00:00Z"));
		resolver.register(makeEntity("m-1", 2, "2024-06-01T00:00:00Z"));
		resolver.register(makeEntity("m-1", 3, "2024-12-01T00:00:00Z"));

		const result = resolver.resolveByTimestamp({
			entityId: "m-1",
			atOrBefore: "2024-07-01T00:00:00Z",
		});

		expect(result.found).toBe(true);
		if (result.found) expect(result.entity.version).toBe(2);
	});

	it("returns not found when timestamp is before all versions", () => {
		resolver.register(makeEntity("m-1", 1, "2024-06-01T00:00:00Z"));

		const result = resolver.resolveByTimestamp({
			entityId: "m-1",
			atOrBefore: "2024-01-01T00:00:00Z",
		});

		expect(result.found).toBe(false);
	});

	it("resolves latest version", () => {
		resolver.register(makeEntity("m-1", 1, "2024-01-01T00:00:00Z"));
		resolver.register(makeEntity("m-1", 3, "2024-03-01T00:00:00Z"));
		resolver.register(makeEntity("m-1", 2, "2024-02-01T00:00:00Z"));

		const result = resolver.resolveLatest("m-1");
		expect(result.found).toBe(true);
		if (result.found) expect(result.entity.version).toBe(3);
	});

	it("does not duplicate registration of same version", () => {
		const e = makeEntity("m-1", 1, "2024-01-01T00:00:00Z");
		resolver.register(e);
		resolver.register(e);
		expect(resolver.listVersions("m-1")).toHaveLength(1);
	});

	it("clears all state", () => {
		resolver.register(makeEntity("m-1", 1, "2024-01-01T00:00:00Z"));
		resolver.clear();
		expect(resolver.listVersions("m-1")).toHaveLength(0);
	});
});
