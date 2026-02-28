"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
	{ label: "General", href: "/settings" },
	{ label: "Organization", href: "/settings/organization" },
	{ label: "Billing", href: "/settings/billing" },
] as const;

export default function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	const isActive = (href: string) =>
		href === "/settings" ? pathname === "/settings" : pathname.startsWith(href);

	return (
		<div className="flex flex-col gap-6 md:flex-row md:gap-10">
			<aside className="w-full md:w-48 shrink-0">
				<nav className="flex md:flex-col gap-1">
					{navItems.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"rounded-md px-3 py-2 text-sm font-medium transition-colors",
								isActive(item.href)
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
							)}
						>
							{item.label}
						</Link>
					))}
				</nav>
			</aside>
			<div className="flex-1 min-w-0">{children}</div>
		</div>
	);
}
