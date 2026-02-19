import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

/**
 * Safe localStorage hook with null checks and error handling
 * Replaces direct localStorage.getItem calls
 */
export function useSafeStorage<T = string>(
  key: string,
  defaultValue?: T,
): [T | null, (value: T | null) => void, boolean] {
  const [value, setValue] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        // Try to parse as JSON, fallback to string
        try {
          setValue(JSON.parse(item) as T);
        } catch {
          setValue(item as T);
        }
      } else if (defaultValue !== undefined) {
        setValue(defaultValue);
      }
    } catch (error) {
      logger.error(`Failed to read from localStorage: ${key}`, error);
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue]);

  const setStorageValue = (newValue: T | null) => {
    try {
      setValue(newValue);

      if (newValue === null) {
        localStorage.removeItem(key);
      } else {
        const stringValue = typeof newValue === "string" ? newValue : JSON.stringify(newValue);
        localStorage.setItem(key, stringValue);
      }
    } catch (error) {
      logger.error(`Failed to write to localStorage: ${key}`, error);
    }
  };

  return [value, setStorageValue, isLoading];
}

/**
 * Get bearer token helper for legacy call-sites.
 *
 * Browser auth now uses HttpOnly cookies; we return a non-empty sentinel so
 * legacy callers that guard on `if (!token)` continue issuing requests while
 * secureRoute falls back to cookie auth.
 */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return "cookie-session";
}

/**
 * Deprecated no-op: bearer tokens are no longer persisted in localStorage.
 */
export function setBearerToken(token: string | null): void {
  void token;
}
