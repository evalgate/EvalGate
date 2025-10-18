import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

type DynamicOptions<T> = {
  loading?: () => JSX.Element | null;
  ssr?: boolean;
};

export function dynamicImport<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  options?: DynamicOptions<T>
) {
  return dynamic(loader, {
    loading: options?.loading,
    ssr: options?.ssr !== false,
  });
}
