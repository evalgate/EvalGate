"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth-client";

export default function OnboardingPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/auth/login");
      return;
    }

    if (session?.user) {
      // Check if user already has an organization
      fetch("/api/organizations", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("bearer_token")}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.organizations && data.organizations.length > 0) {
            router.push("/dashboard");
          }
        });
    }
  }, [session, isPending, router]);

  // Auto-generate slug from organization name
  useEffect(() => {
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setOrganizationSlug(slug);
  }, [organizationName]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("bearer_token")}`,
        },
        body: JSON.stringify({
          name: organizationName,
          slug: organizationSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization");
      }

      toast.success("Organization created successfully!");
      router.push("/dashboard");
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes("duplicate") || error.message.includes("already taken")) {
          setError("This organization name is already taken. Please choose another.");
        } else {
          setError(error.message);
        }
      } else {
        setError("An error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isPending || !session?.user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome!</h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground px-2">
            Let's set up your organization to get started
          </p>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">Create your organization</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Organizations help you collaborate with your team on AI evaluations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <form onSubmit={handleCreateOrganization}>
              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="organizationName" className="text-sm">
                    Organization name
                  </Label>
                  <Input
                    id="organizationName"
                    type="text"
                    placeholder="Acme Inc"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="h-9 sm:h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="organizationSlug" className="text-sm">
                    Organization slug
                  </Label>
                  <Input
                    id="organizationSlug"
                    type="text"
                    placeholder="acme-inc"
                    required
                    value={organizationSlug}
                    onChange={(e) => setOrganizationSlug(e.target.value)}
                    className="font-mono text-xs sm:text-sm h-9 sm:h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be used in your organization's URL
                  </p>
                </div>
                {error && (
                  <div className="rounded-md bg-destructive/10 p-2 sm:p-3 text-xs sm:text-sm text-destructive">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full h-9 sm:h-10" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
