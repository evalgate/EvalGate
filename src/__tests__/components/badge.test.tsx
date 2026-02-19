import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("should render children", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeDefined();
  });

  it("should render with default variant", () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.querySelector("[data-slot='badge']")).toBeDefined();
  });

  it("should render with secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary")).toBeDefined();
  });

  it("should render with destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error")).toBeDefined();
  });

  it("should render with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toBeDefined();
  });
});
