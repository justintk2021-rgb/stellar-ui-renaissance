import { useCallback } from 'react';

export function useThemeTransition() {
  const setThemeWithTransition = useCallback((newTheme: 'dark' | 'light', setTheme: (theme: 'dark' | 'light') => void) => {
    // Add transition class
    document.documentElement.classList.add('theme-transition');
    
    // Apply the theme
    setTheme(newTheme);
    
    // Remove transition class after animation completes
    const timeout = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
    
    return () => clearTimeout(timeout);
  }, []);

  return { setThemeWithTransition };
}
