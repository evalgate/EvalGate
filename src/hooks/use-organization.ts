import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

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
        const token = localStorage.getItem('bearer_token');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('/api/organizations/current', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch organization: ${response.statusText}`);
        }

        const data = await response.json();
        setOrganization(data.organization);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        logger.error('Failed to fetch organization', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganization();
  }, []);

  return { organization, isLoading, error };
}

/**
 * Hook to get organization ID with fallback
 * For backward compatibility during migration
 */
export function useOrganizationId(): number | null {
  const { organization, isLoading } = useOrganization();
  
  // Return null while loading to prevent using wrong ID
  if (isLoading) {
    return null;
  }
  
  // Fallback to 1 only in development
  if (!organization && process.env.NODE_ENV === 'development') {
    logger.warn('Organization not found, using fallback ID 1 (development only)');
    return 1;
  }
  
  return organization?.id || null;
}

