import { describe, expect, it } from "vitest";
import { parsePaginationParams } from "@/lib/validation";

describe("parsePaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const params = new URLSearchParams();
    expect(parsePaginationParams(params)).toEqual({ limit: 50, offset: 0 });
  });

  it("parses limit and offset from query string", () => {
    const params = new URLSearchParams({ limit: "20", offset: "10" });
    expect(parsePaginationParams(params)).toEqual({ limit: 20, offset: 10 });
  });

  it("coerces string values to numbers", () => {
    const params = new URLSearchParams({ limit: "100", offset: "5" });
    expect(parsePaginationParams(params)).toEqual({ limit: 100, offset: 5 });
  });

  it("rejects limit above 1000", () => {
    const params = new URLSearchParams({ limit: "2000", offset: "0" });
    expect(() => parsePaginationParams(params)).toThrow();
  });

  it("rejects limit below 1", () => {
    const params = new URLSearchParams({ limit: "0", offset: "0" });
    expect(() => parsePaginationParams(params)).toThrow();
  });

  it("rejects negative offset", () => {
    const params = new URLSearchParams({ limit: "50", offset: "-5" });
    expect(() => parsePaginationParams(params)).toThrow();
  });
});
