export type AppTheme = 'dark' | 'light' | 'liquid-glass';

/** The underlying light/dark palette a theme uses. Liquid Glass is built on dark. */
export type BaseTheme = 'dark' | 'light';

export function getBaseTheme(theme: AppTheme): BaseTheme {
  return theme === 'light' ? 'light' : 'dark';
}

export function isLiquidGlassTheme(theme: AppTheme): boolean {
  return theme === 'liquid-glass';
}

const themeListeners = new Set<() => void>();
let notifyRaf = 0;

export function getDocumentTheme(): AppTheme {
  if (typeof document === 'undefined') return 'dark';
  if (document.documentElement.classList.contains('liquid-glass')) return 'liquid-glass';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function subscribeToTheme(onStoreChange: () => void): () => void {
  themeListeners.add(onStoreChange);
  return () => themeListeners.delete(onStoreChange);
}

function scheduleAppearanceNotify() {
  if (notifyRaf) return;
  notifyRaf = requestAnimationFrame(() => {
    notifyRaf = 0;
    document.documentElement.dispatchEvent(new CustomEvent('appearance-change'));
  });
}

/** Coalesced appearance refresh for accent/color changes that skip setDocumentTheme. */
export function notifyAppearanceChange() {
  scheduleAppearanceNotify();
}

/** Instant DOM theme swap. Notifies subscribers synchronously so UI updates before React.
 *  Liquid Glass is a dark-based glass surface: it keeps the `dark` palette class
 *  and adds `liquid-glass`, so dark CSS variables stay in effect and the glass
 *  overrides in index.css apply on top. */
export function setDocumentTheme(theme: AppTheme): boolean {
  const root = document.documentElement;

  if (theme === 'liquid-glass') {
    const changed = !root.classList.contains('liquid-glass') || root.classList.contains('light');
    root.classList.remove('light');
    root.classList.add('dark', 'liquid-glass');
    if (!changed) return false;
    themeListeners.forEach((listener) => listener());
    scheduleAppearanceNotify();
    return true;
  }

  const target = theme === 'light' ? 'light' : 'dark';
  const changed = !root.classList.contains(target) || root.classList.contains('liquid-glass');

  if (!changed) {
    return false;
  }

  root.classList.remove('light', 'dark', 'liquid-glass');
  root.classList.add(target);

  themeListeners.forEach((listener) => listener());
  scheduleAppearanceNotify();
  return true;
}

/** @deprecated Use setDocumentTheme */
export function applyThemeInstant(theme: AppTheme): boolean {
  return setDocumentTheme(theme);
}
