export type AppTheme = 'dark' | 'light';

const themeListeners = new Set<() => void>();
let notifyRaf = 0;

export function getDocumentTheme(): AppTheme {
  if (typeof document === 'undefined') return 'dark';
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

/** Instant DOM theme swap. Notifies subscribers synchronously so UI updates before React. */
export function setDocumentTheme(theme: AppTheme): boolean {
  const root = document.documentElement;
  const target = theme === 'light' ? 'light' : 'dark';

  if (root.classList.contains(target)) {
    return false;
  }

  root.classList.remove('light', 'dark');
  root.classList.add(target);

  themeListeners.forEach((listener) => listener());
  scheduleAppearanceNotify();
  return true;
}

/** @deprecated Use setDocumentTheme */
export function applyThemeInstant(theme: AppTheme): boolean {
  return setDocumentTheme(theme);
}
