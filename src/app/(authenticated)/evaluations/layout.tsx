import Link from "next/link";

export default function EvaluationsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-4">
			<nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
				<Link
					href="/evaluations"
					className="font-medium text-foreground hover:underline"
				>
					Evaluations
				</Link>
			</nav>
			{children}
		</div>
	);
}
