import { useCallback } from 'react';

export function useThemeTransition() {
  const setThemeWithTransition = useCallback((newTheme: 'dark' | 'light', setTheme: (theme: 'dark' | 'light') => void) => {
    // Use View Transitions API for seamless theme switching if available
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setTheme(newTheme);
      });
    } else {
      // Fallback for browsers without View Transitions API
      document.documentElement.classList.add('theme-transition');
      setTheme(newTheme);
      
      // Use requestAnimationFrame for smoother transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
          }, 200);
        });
      });
    }
  }, []);

  return { setThemeWithTransition };
}
