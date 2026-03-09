import { Suspense } from "react";
import { CandidatesClient } from "@/components/candidates/client";

export default function CandidatesPage() {
	return (
		<div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
			<div className="flex items-center justify-between space-y-2">
				<h2 className="text-3xl font-bold tracking-tight">Candidates</h2>
			</div>
			<Suspense fallback={<div>Loading candidates...</div>}>
				<CandidatesClient />
			</Suspense>
		</div>
	);
}
