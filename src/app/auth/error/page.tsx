import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
	OAuthAccountNotLinked:
		"An account with this email already exists. Please sign in with your original method.",
	OAuthCallbackError: "Authentication failed. Please try again.",
	AccessDenied: "Access denied. You don't have permission to sign in.",
};

function getErrorMessage(error?: string, description?: string): string {
	if (description) return description;
	if (error && error in ERROR_MESSAGES) return ERROR_MESSAGES[error];
	return "An unexpected error occurred during authentication.";
}

export default async function AuthErrorPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
	const params = await searchParams;
	const message = getErrorMessage(params?.error, params?.error_description);

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
			<div className="w-full max-w-md">
				<div className="mb-6 sm:mb-8 text-center">
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
						EvalGate
					</h1>
				</div>

				<Card className="border-gray-800">
					<CardHeader className="text-center p-4 sm:p-6">
						<div className="mx-auto mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
						</div>
						<CardTitle className="text-xl sm:text-2xl">
							Authentication Error
						</CardTitle>
						<CardDescription className="text-xs sm:text-sm">
							Something went wrong during authentication
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
						<div className="rounded-md bg-destructive/10 p-3 sm:p-4 text-xs sm:text-sm text-destructive">
							{message}
						</div>
						<Button asChild className="w-full h-9 sm:h-10">
							<Link href="/auth/login">Try again</Link>
						</Button>
						<div className="text-center">
							<Link
								href="/"
								className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
							>
								Go home
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
