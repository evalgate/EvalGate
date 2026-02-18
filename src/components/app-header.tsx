"use client";

import { useCustomer } from "autumn-js/react";
import { Building2, LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

interface AppHeaderProps {
  user: {
    email?: string;
    name?: string;
  };
  organization?: {
    name: string;
  };
}

export function AppHeader({ user, organization }: AppHeaderProps) {
  const router = useRouter();
  const { customer, isLoading } = useCustomer();

  const handleSignOut = async () => {
    const { error } = await authClient.signOut();
    if (error?.code) {
      toast.error("Failed to sign out");
    } else {
      localStorage.removeItem("bearer_token");
      router.push("/");
      router.refresh();
    }
  };

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "U";

  const currentPlan = customer?.products?.[0];
  const planName = currentPlan?.name || "Developer";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        {organization && (
          <>
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{organization.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!isLoading && (
          <Link href="/pricing" prefetch={true}>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">{planName}</span>
            </Button>
          </Link>
        )}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
