'use client';

import React from 'react';
import { componentRegistry } from './registry';

interface JsonRenderProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for json-render integration
 * Wraps the app and provides access to the component registry
 */
export default function JsonRenderProvider({ children }: JsonRenderProviderProps) {
  return <>{children}</>;
}

// Hook to access the registry
export function useComponentRegistry() {
  return componentRegistry;
}
