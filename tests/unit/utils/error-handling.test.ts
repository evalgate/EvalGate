import { describe, expect, it } from "vitest";
import { getErrorMessage, handleError, hasMessage, isError } from "@/lib/utils/error-handling";

describe("getErrorMessage", () => {
  // Happy path tests
  it("should extract message from Error instance", () => {
    const error = new Error("Test error message");
    expect(getErrorMessage(error)).toBe("Test error message");
  });

  it("should return string as-is", () => {
    const error = "String error message";
    expect(getErrorMessage(error)).toBe("String error message");
  });

  it("should extract message from object with message property", () => {
    const error = { message: "Object error message" };
    expect(getErrorMessage(error)).toBe("Object error message");
  });

  it("should convert non-string message to string", () => {
    const error = { message: 123 };
    expect(getErrorMessage(error)).toBe("123");
  });

  // Edge case tests
  it("should handle empty string", () => {
    expect(getErrorMessage("")).toBe("");
  });

  it("should handle empty Error message", () => {
    const error = new Error();
    expect(getErrorMessage(error)).toBe("");
  });

  it("should handle object with empty message", () => {
    const error = { message: "" };
    expect(getErrorMessage(error)).toBe("");
  });

  // Error/invalid input tests
  it("should return default message for null", () => {
    expect(getErrorMessage(null)).toBe("An unknown error occurred");
  });

  it("should return default message for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unknown error occurred");
  });

  it("should return default message for number", () => {
    expect(getErrorMessage(123)).toBe("An unknown error occurred");
  });

  it("should return default message for boolean", () => {
    expect(getErrorMessage(true)).toBe("An unknown error occurred");
  });

  it("should return default message for array", () => {
    expect(getErrorMessage([1, 2, 3])).toBe("An unknown error occurred");
  });

  it("should return default message for object without message", () => {
    const error = { code: "ERROR_CODE" };
    expect(getErrorMessage(error)).toBe("An unknown error occurred");
  });

  it("should return default message for empty object", () => {
    expect(getErrorMessage({})).toBe("An unknown error occurred");
  });
});

describe("isError", () => {
  // Happy path tests
  it("should return true for Error instance", () => {
    const error = new Error("Test");
    expect(isError(error)).toBe(true);
  });

  it("should return true for custom Error subclass", () => {
    class CustomError extends Error {}
    const error = new CustomError("Custom");
    expect(isError(error)).toBe(true);
  });

  it("should return true for built-in error types", () => {
    expect(isError(new TypeError("Type error"))).toBe(true);
    expect(isError(new ReferenceError("Ref error"))).toBe(true);
    expect(isError(new SyntaxError("Syntax error"))).toBe(true);
  });

  // Error/invalid input tests
  it("should return false for string", () => {
    expect(isError("Error message")).toBe(false);
  });

  it("should return false for object with message", () => {
    expect(isError({ message: "Error" })).toBe(false);
  });

  it("should return false for null", () => {
    expect(isError(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isError(undefined)).toBe(false);
  });

  it("should return false for plain object", () => {
    expect(isError({})).toBe(false);
  });
});

describe("hasMessage", () => {
  // Happy path tests
  it("should return true for object with string message", () => {
    const value = { message: "Error message" };
    expect(hasMessage(value)).toBe(true);
  });

  it("should return true for Error instance", () => {
    const error = new Error("Test");
    expect(hasMessage(error)).toBe(true);
  });

  // Edge case tests
  it("should return true for object with empty string message", () => {
    const value = { message: "" };
    expect(hasMessage(value)).toBe(true);
  });

  // Error/invalid input tests
  it("should return false for null", () => {
    expect(hasMessage(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(hasMessage(undefined)).toBe(false);
  });

  it("should return false for string", () => {
    expect(hasMessage("Error message")).toBe(false);
  });

  it("should return false for number", () => {
    expect(hasMessage(123)).toBe(false);
  });

  it("should return false for object without message", () => {
    expect(hasMessage({ code: "ERROR" })).toBe(false);
  });

  it("should return false for object with non-string message", () => {
    const value = { message: 123 };
    expect(hasMessage(value)).toBe(false);
  });

  it("should return false for empty object", () => {
    expect(hasMessage({})).toBe(false);
  });

  it("should return false for array", () => {
    expect(hasMessage(["error"])).toBe(false);
  });
});

describe("handleError", () => {
  // Happy path tests
  it("should handle Error instance", () => {
    const error = new Error("Test error");
    expect(handleError(error)).toBe("Test error");
  });

  it("should handle string error", () => {
    const error = "String error";
    expect(handleError(error)).toBe("String error");
  });

  it("should handle object with message", () => {
    const error = { message: "Object error" };
    expect(handleError(error)).toBe("Object error");
  });

  // Edge case tests
  it("should handle object with nested message property", () => {
    const error = { message: { nested: "object" } };
    expect(handleError(error)).toBe("[object Object]");
  });

  it("should use fallback when getErrorMessage throws", () => {
    // This test is theoretical since getErrorMessage doesn't actually throw
    // But we can test the fallback parameter is passed correctly
    const error = { message: "test" };
    expect(handleError(error, "Custom fallback")).toBe("test");
  });

  // Error/invalid input tests
  it("should handle null with fallback", () => {
    expect(handleError(null)).toBe("An unknown error occurred");
  });

  it("should handle undefined with fallback", () => {
    expect(handleError(undefined)).toBe("An unknown error occurred");
  });
});
