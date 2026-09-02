import { startTransition, useCallback } from 'react';
import { setDocumentTheme, type AppTheme } from '@/lib/theme';

export function useThemeChange(setTheme: (theme: AppTheme) => void) {
  return useCallback(
    (newTheme: AppTheme) => {
      setDocumentTheme(newTheme);
      startTransition(() => setTheme(newTheme));
    },
    [setTheme]
  );
}

/** @deprecated Use useThemeChange */
export function useThemeTransition() {
  const setThemeWithTransition = useCallback(
    (newTheme: AppTheme, setTheme: (theme: AppTheme) => void) => {
      setDocumentTheme(newTheme);
      startTransition(() => setTheme(newTheme));
    },
    []
  );
  return { setThemeWithTransition };
}
