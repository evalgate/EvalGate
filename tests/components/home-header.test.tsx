/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock auth-client
vi.mock("@/lib/auth-client", () => ({
	useSession: vi.fn(() => ({ data: null, isPending: false })),
	authClient: { signOut: vi.fn().mockResolvedValue({}) },
}));

// Mock next-themes
vi.mock("next-themes", () => ({
	useTheme: vi.fn(() => ({ theme: "light", setTheme: vi.fn() })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock sonner
vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

import { HomeHeader } from "@/components/home-header";

describe("HomeHeader", () => {
	it("should render the brand name", () => {
		render(<HomeHeader />);
		expect(screen.getByText("EvalGate")).toBeDefined();
	});

	it("should show sign-in and get-started when logged out", () => {
		render(<HomeHeader />);
		expect(screen.getByText("Sign in")).toBeDefined();
		expect(screen.getByText("Get started")).toBeDefined();
	});

	it("should render as a sticky header", () => {
		const { container } = render(<HomeHeader />);
		const header = container.querySelector("header");
		expect(header?.className).toContain("sticky");
	});
});
