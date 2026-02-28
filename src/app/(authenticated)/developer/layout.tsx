"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
	{ label: "Overview", href: "/developer" },
	{ label: "API Keys", href: "/developer/api-keys" },
	{ label: "SDK", href: "/developer/sdk" },
	{ label: "API Reference", href: "/developer/api-reference" },
	{ label: "Webhooks", href: "/developer/webhooks" },
] as const;

export default function DeveloperLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	const isActive = (href: string) =>
		href === "/developer"
			? pathname === "/developer"
			: pathname.startsWith(href);

	return (
		<div className="space-y-6">
			<nav className="flex gap-1 border-b overflow-x-auto">
				{tabs.map((tab) => (
					<Link
						key={tab.href}
						href={tab.href}
						className={cn(
							"whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
							isActive(tab.href)
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50",
						)}
					>
						{tab.label}
					</Link>
				))}
			</nav>
			{children}
		</div>
	);
}
