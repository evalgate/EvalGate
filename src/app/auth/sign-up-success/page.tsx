import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Evaluation Platform</h1>
        </div>

        <Card className="border-gray-800">
          <CardHeader className="text-center p-4 sm:p-6">
            <div className="mx-auto mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-500/10">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Check your email</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              We've sent you a confirmation link to verify your account
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="rounded-md bg-gray-900 p-3 sm:p-4 text-xs sm:text-sm text-gray-400">
              <p className="mb-2">
                <strong className="text-white">Next steps:</strong>
              </p>
              <ol className="ml-3 sm:ml-4 list-decimal space-y-1">
                <li>Check your email inbox</li>
                <li>Click the confirmation link</li>
                <li>Complete your organization setup</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
