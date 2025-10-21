import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Safe localStorage hook with null checks and error handling
 * Replaces direct localStorage.getItem calls
 */
export function useSafeStorage<T = string>(
  key: string,
  defaultValue?: T
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
        const stringValue = typeof newValue === 'string' 
          ? newValue 
          : JSON.stringify(newValue);
        localStorage.setItem(key, stringValue);
      }
    } catch (error) {
      logger.error(`Failed to write to localStorage: ${key}`, error);
    }
  };

  return [value, setStorageValue, isLoading];
}

/**
 * Get bearer token safely with null check
 */
export function getBearerToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem('bearer_token');
  } catch (error) {
    logger.error('Failed to get bearer token from localStorage', error);
    return null;
  }
}

/**
 * Set bearer token safely
 */
export function setBearerToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (token === null) {
      localStorage.removeItem('bearer_token');
    } else {
      localStorage.setItem('bearer_token', token);
    }
  } catch (error) {
    logger.error('Failed to set bearer token in localStorage', error);
  }
}

