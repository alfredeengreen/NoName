'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // next-themes handles hydration automatically, but we need to ensure
  // it doesn't cause mismatches by using enableSystem and proper defaults
  return (
    <NextThemesProvider
      {...props}
      // Force a key to ensure consistent rendering
      key="theme-provider"
    >
      {children}
    </NextThemesProvider>
  );
}

