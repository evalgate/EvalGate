"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { Organization } from "@/types";

// Lazy load heavy components with proper typing
const AppSidebar = dynamic<
  React.ComponentProps<typeof import("@/components/app-sidebar").AppSidebar>
>(() => import("@/components/app-sidebar").then((mod) => mod.AppSidebar), {
  ssr: false,
  loading: () => <div className="w-64 bg-background border-r h-screen" />,
});

const AppHeader = dynamic<React.ComponentProps<typeof import("@/components/app-header").AppHeader>>(
  () => import("@/components/app-header").then((mod) => mod.AppHeader),
  {
    ssr: false,
    loading: () => <div className="h-16 border-b w-full" />,
  },
);

const SidebarProvider = dynamic(
  () => import("@/components/ui/sidebar").then((mod) => mod.SidebarProvider),
  { ssr: false },
);

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [_organization, setOrganization] = useState<Organization | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) {
      const redirectUrl = pathname
        ? `/auth/login?redirect=${encodeURIComponent(pathname)}`
        : "/auth/login";
      router.push(redirectUrl);
    }
  }, [session, isPending, router, pathname]);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!session?.user) return;

      setIsLoadingOrg(true);
      try {
        const response = await fetch("/api/organizations/current", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setOrganization(data.organization);
        } else if (response.status === 404) {
          router.push("/onboarding");
          return;
        }
      } catch (error) {
        console.error("Failed to fetch organization:", error);
      } finally {
        setIsLoadingOrg(false);
      }
    };

    fetchOrganization();
  }, [session, router]);

  if (isPending || isLoadingOrg) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const _userData = {
    email: session.user.email,
    full_name: session.user.name,
  };

  return (
    <Suspense fallback={<div className="h-screen w-full bg-background" />}>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <Suspense fallback={<div className="w-64 bg-background border-r h-full" />}>
            <AppSidebar />
          </Suspense>
          <div className="flex flex-col flex-1 min-w-0">
            <Suspense fallback={<div className="h-16 border-b w-full" />}>
              <AppHeader
                user={{
                  email: session?.user?.email,
                  name: session?.user?.name,
                }}
              />
            </Suspense>
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 w-full">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </Suspense>
  );
}
