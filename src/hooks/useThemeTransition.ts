import { useCallback } from 'react';

export function useThemeTransition() {
  const setThemeWithTransition = useCallback((newTheme: 'dark' | 'light', setTheme: (theme: 'dark' | 'light') => void) => {
    // Use View Transitions API for instant theme switching if available
    if (document.startViewTransition) {
      const transition = document.startViewTransition(() => {
        setTheme(newTheme);
      });
      // Keep transition snappy
      transition.ready.catch(() => {});
    } else {
      // Instant switch - no transition classes needed
      setTheme(newTheme);
    }
  }, []);

  return { setThemeWithTransition };
}
