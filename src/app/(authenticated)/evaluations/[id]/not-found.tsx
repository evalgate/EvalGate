import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function EvaluationNotFound() {
	return (
		<div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
			<FileQuestion className="mb-6 h-16 w-16 text-muted-foreground" />
			<h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
				Evaluation not found
			</h1>
			<p className="mb-8 text-muted-foreground">
				This evaluation may have been deleted or you may not have access to it.
			</p>
			<Link
				href="/evaluations"
				className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Back to Evaluations
			</Link>
		</div>
	);
}
