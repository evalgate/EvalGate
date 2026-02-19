import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "@/components/ui/spinner";

describe("Spinner", () => {
  it("should render with loading role and aria-label", () => {
    render(<Spinner />);
    const el = screen.getByRole("status", { name: "Loading" });
    expect(el).toBeDefined();
  });

  it("should accept and apply className", () => {
    render(<Spinner className="custom-class" />);
    const el = screen.getByRole("status", { name: "Loading" });
    expect(el.className).toContain("custom-class");
  });
});
