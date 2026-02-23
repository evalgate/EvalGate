import { beforeEach, describe, expect, it, vi } from "vitest";
import { scopedDb } from "@/lib/db/scoped-db";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          // Mock the chain for select queries
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

// Mock drizzle eq function
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column, value) => ({ column, value })),
}));

describe("Scoped DB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scopedDb", () => {
    it("should create a scoped database with organization context", () => {
      const organizationId = 123;
      const sdb = scopedDb(organizationId);

      expect(sdb).toHaveProperty("selectFrom");
      expect(sdb).toHaveProperty("deleteFrom");
      expect(sdb).toHaveProperty("raw");
      expect(sdb.organizationId).toBe(organizationId);
    });

    it("should create scoped select queries with organization filter", async () => {
      const { db } = await import("@/db");
      const { eq } = await import("drizzle-orm");

      const organizationId = 456;
      const sdb = scopedDb(organizationId);

      // Mock table with organizationId column
      const mockTable = {
        organizationId: { name: "organizationId" },
        id: { name: "id" },
      };

      // Call selectFrom
      const query = sdb.selectFrom(mockTable as any);

      // Verify the query chain was called correctly
      expect(db.select).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(mockTable.organizationId, organizationId);
    });

    it("should create scoped delete queries with organization filter", async () => {
      const { db } = await import("@/db");
      const { eq } = await import("drizzle-orm");

      const organizationId = 789;
      const sdb = scopedDb(organizationId);

      // Mock table with organizationId column
      const mockTable = {
        organizationId: { name: "organizationId" },
        id: { name: "id" },
      };

      // Call deleteFrom
      const query = sdb.deleteFrom(mockTable as any);

      // Verify the query chain was called correctly
      expect(db.delete).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(mockTable.organizationId, organizationId);
    });

    it("should provide access to raw database for join-through patterns", async () => {
      const { db } = await import("@/db");
      const organizationId = 999;
      const sdb = scopedDb(organizationId);

      // Verify raw db is accessible
      expect(sdb.raw).toBe(db);
    });

    it("should maintain separate scopes for different organizations", () => {
      const org1Id = 111;
      const org2Id = 222;

      const sdb1 = scopedDb(org1Id);
      const sdb2 = scopedDb(org2Id);

      expect(sdb1.organizationId).toBe(org1Id);
      expect(sdb2.organizationId).toBe(org2Id);
      expect(sdb1.organizationId).not.toBe(sdb2.organizationId);
    });
  });
});
