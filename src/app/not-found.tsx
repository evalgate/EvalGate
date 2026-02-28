import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
			<FileQuestion className="mb-6 h-16 w-16 text-muted-foreground" />
			<h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
				Page Not Found
			</h1>
			<p className="mb-8 max-w-md text-muted-foreground">
				The page you&apos;re looking for doesn&apos;t exist or has been moved.
			</p>
			<Link
				href="/"
				className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Go to Home
			</Link>
		</div>
	);
}
