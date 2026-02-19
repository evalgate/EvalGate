import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/copy-button";

describe("CopyButton", () => {
  it("should render copy icon initially", () => {
    render(<CopyButton code="test-code" />);
    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    // Lucide Copy icon renders an svg
    expect(button.querySelector("svg")).toBeDefined();
  });

  it("should invoke copy on click without throwing", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });

    render(<CopyButton code="code-to-copy" />);
    fireEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith("code-to-copy");
  });
});
