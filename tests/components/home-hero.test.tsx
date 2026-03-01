/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock auth-client
vi.mock("@/lib/auth-client", () => ({
	useSession: vi.fn(() => ({ data: null, isPending: false })),
}));

// Mock autumn-js/react
vi.mock("autumn-js/react", () => ({
	useCustomer: vi.fn(() => ({ customer: null, isLoading: false })),
}));

import { HomeHero } from "@/components/home-hero";

describe("HomeHero", () => {
	it("should render the main heading", () => {
		render(<HomeHero />);
		expect(screen.getByText(/Stop LLM Regressions in CI in/)).toBeDefined();
		expect(screen.getByText("2 Minutes")).toBeDefined();
	});

	it("should render the subtitle", () => {
		render(<HomeHero />);
		expect(screen.getByText(/No infra\. No lock-in/)).toBeDefined();
	});

	it("should show 'Get Started Free' when logged out", () => {
		render(<HomeHero />);
		expect(screen.getByText("Get Started Free")).toBeDefined();
		expect(screen.getByText("Try It Now")).toBeDefined();
		expect(screen.getByText("View Documentation")).toBeDefined();
	});

	it("should show dashboard links when logged in", async () => {
		const { useSession } = await import("@/lib/auth-client");
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "1", name: "Test", email: "test@test.com" } },
			isPending: false,
			error: null,
			refetch: vi.fn(),
		});
		render(<HomeHero />);
		expect(screen.getByText("Go to Dashboard")).toBeDefined();
		expect(screen.getByText("Create Evaluation")).toBeDefined();
	});
});
