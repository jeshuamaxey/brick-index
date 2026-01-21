'use client';

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Custom hook to detect and track the current theme based on the 'dark' class on the HTML element.
 * Returns 'dark' if the HTML element has the 'dark' class, otherwise returns 'light'.
 * 
 * @returns The current theme ('light' | 'dark')
 * 
 * @example
 * ```tsx
 * const theme = useTheme();
 * // theme will be 'dark' if <html class="dark">, otherwise 'light'
 * ```
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize from current HTML class
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    // Create a MutationObserver to watch for changes to the HTML classList
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    });

    // Observe changes to the HTML element's class attribute
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}
