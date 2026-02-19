import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

describe("Empty", () => {
  it("should render children", () => {
    render(
      <Empty>
        <span>No items</span>
      </Empty>,
    );
    expect(screen.getByText("No items")).toBeDefined();
  });

  it("should have data-slot empty", () => {
    const { container } = render(<Empty />);
    expect(container.querySelector("[data-slot='empty']")).toBeDefined();
  });
});

describe("EmptyHeader", () => {
  it("should render children", () => {
    render(<EmptyHeader>Header text</EmptyHeader>);
    expect(screen.getByText("Header text")).toBeDefined();
  });
});

describe("EmptyTitle", () => {
  it("should render title", () => {
    render(<EmptyTitle>Title</EmptyTitle>);
    expect(screen.getByText("Title")).toBeDefined();
  });
});

describe("EmptyDescription", () => {
  it("should render description", () => {
    render(<EmptyDescription>Description text</EmptyDescription>);
    expect(screen.getByText("Description text")).toBeDefined();
  });
});

describe("EmptyMedia", () => {
  it("should render with default variant", () => {
    const { container } = render(<EmptyMedia />);
    expect(container.querySelector("[data-slot='empty-icon']")).toBeDefined();
  });

  it("should apply icon variant", () => {
    const { container } = render(<EmptyMedia variant="icon" />);
    const el = container.querySelector("[data-slot='empty-icon']");
    expect(el?.getAttribute("data-variant")).toBe("icon");
  });
});

describe("EmptyContent", () => {
  it("should render children", () => {
    render(<EmptyContent>Content</EmptyContent>);
    expect(screen.getByText("Content")).toBeDefined();
  });
});
