import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

interface Organization {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook to get current user's organization
 * Replaces hardcoded organizationId = 1
 */
export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const response = await fetch("/api/organizations/current", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch organization: ${response.statusText}`);
        }

        const data = await response.json();
        setOrganization(data.organization);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        logger.error("Failed to fetch organization", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  return { organization, isLoading, error };
}

/**
 * Hook to get organization ID
 * Returns null when loading or when user has no organization
 */
export function useOrganizationId(): number | null {
  const { organization, isLoading } = useOrganization();

  if (isLoading) {
    return null;
  }

  return organization?.id ?? null;
}
