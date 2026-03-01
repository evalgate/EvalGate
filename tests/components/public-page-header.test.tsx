/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock auth-client
vi.mock("@/lib/auth-client", () => ({
	useSession: vi.fn(() => ({ data: null, isPending: false })),
	authClient: { signOut: vi.fn() },
}));

// Mock next-themes
vi.mock("next-themes", () => ({
	useTheme: vi.fn(() => ({ theme: "light", setTheme: vi.fn() })),
}));

import { PublicPageHeader } from "@/components/public-page-header";

describe("PublicPageHeader", () => {
	it("should render the platform title", () => {
		render(<PublicPageHeader />);
		expect(screen.getByText("EvalGate")).toBeDefined();
	});

	it("should show sign-in and get-started when logged out", () => {
		render(<PublicPageHeader />);
		expect(screen.getByText("Sign in")).toBeDefined();
		expect(screen.getByText("Get started")).toBeDefined();
	});

	it("should show dashboard link when logged in", async () => {
		const { useSession } = await import("@/lib/auth-client");
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "1", name: "Test", email: "test@test.com" } },
			isPending: false,
			error: null,
			refetch: vi.fn(),
		});
		render(<PublicPageHeader />);
		expect(screen.getByText("Dashboard")).toBeDefined();
	});
});
