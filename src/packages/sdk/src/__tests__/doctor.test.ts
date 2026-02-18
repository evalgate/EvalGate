/**
 * evalai doctor tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDoctor } from "../cli/doctor";

const mockFetch = vi.fn();

describe("runDoctor", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    // Default: no config, so we need to pass --evaluationId and --apiKey
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 1 when API key is missing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runDoctor(["--evaluationId", "42"]);
    expect(code).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith("Set EVALAI_API_KEY");
    consoleSpy.mockRestore();
  });

  it("calls quality API when apiKey and evaluationId provided", async () => {
    process.env.EVALAI_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          score: 85,
          total: 10,
          baselineMissing: false,
        }),
    });

    const code = await runDoctor(["--evaluationId", "42", "--apiKey", "test-key"]);
    expect(code).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality");
    expect(url).toContain("evaluationId=42");
    expect(url).toContain("action=latest");
    expect(url).toContain("baseline=published");

    delete process.env.EVALAI_API_KEY;
  });

  it("returns 1 when quality API returns baselineMissing", async () => {
    process.env.EVALAI_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          score: 0,
          baselineMissing: true,
        }),
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runDoctor(["--evaluationId", "42", "--apiKey", "test-key"]);
    expect(code).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith("Publish a run or use --baseline previous");
    consoleSpy.mockRestore();
    delete process.env.EVALAI_API_KEY;
  });

  it("returns 1 when quality API returns error status", async () => {
    process.env.EVALAI_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => "Unauthorized",
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runDoctor(["--evaluationId", "42", "--apiKey", "test-key"]);
    expect(code).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Quality API"));
    consoleSpy.mockRestore();
    delete process.env.EVALAI_API_KEY;
  });

  it("prints OK when all checks pass", async () => {
    process.env.EVALAI_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          score: 90,
          total: 5,
          baselineMissing: false,
        }),
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runDoctor(["--evaluationId", "42", "--apiKey", "test-key"]);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("✓ EvalAI doctor: OK");
    logSpy.mockRestore();
    delete process.env.EVALAI_API_KEY;
  });
});
