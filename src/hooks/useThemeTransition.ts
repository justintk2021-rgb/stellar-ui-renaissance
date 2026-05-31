import { useCallback } from 'react';

/**
 * Instant theme swap with no transition flash.
 *
 * Why we need a `theme-switching` class:
 *  Hundreds of components in this app have CSS transitions on `color`,
 *  `background-color`, `border-color`, and `backdrop-filter`. When the
 *  `dark`/`light` class flips on <html>, every one of those properties would
 *  animate at once, causing a multi-hundred-millisecond stutter. The
 *  `theme-switching` class (defined in index.css) forces `transition: none`
 *  on every element. We add it, swap the theme, paint, then remove it on the
 *  next animation frame so future hover/state animations still work.
 *
 * Why the counter:
 *  If the user double-clicks the toggle, each click schedules its own rAF
 *  cleanup. Without a counter, the earlier rAF would remove the class while
 *  the later click is still mid-flight, briefly re-enabling transitions
 *  during the swap. The counter ensures the class only comes off after the
 *  LAST pending toggle settles.
 */

let pendingToggles = 0;

function scheduleCleanup(root: HTMLElement) {
  pendingToggles += 1;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pendingToggles -= 1;
      if (pendingToggles === 0) {
        root.classList.remove('theme-switching');
      }
    });
  });
}

export function useThemeTransition() {
  const setThemeWithTransition = useCallback(
    (newTheme: 'dark' | 'light', setTheme: (theme: 'dark' | 'light') => void) => {
      const root = document.documentElement;

      // Already on this theme? Skip the DOM work entirely.
      if (root.classList.contains(newTheme) && pendingToggles === 0) {
        setTheme(newTheme);
        return;
      }

      root.classList.add('theme-switching');
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      root.dispatchEvent(new CustomEvent('appearance-change'));
      scheduleCleanup(root);

      // Push the React state update onto the next microtask so the browser
      // paints the new theme before React kicks off its (potentially heavy)
      // re-render cascade.
      queueMicrotask(() => setTheme(newTheme));
    },
    []
  );

  return { setThemeWithTransition };
}
