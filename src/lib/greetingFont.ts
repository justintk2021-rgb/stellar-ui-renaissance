/** Ensure Dancing Script is loaded before showing the dashboard greeting (avoids FOUT). */
export async function loadGreetingFont(): Promise<void> {
  if (typeof document === "undefined") return;

  try {
    await Promise.all([
      document.fonts.load('600 1em "Dancing Script"'),
      document.fonts.ready,
    ]);
  } catch {
    // Non-fatal: greeting still renders with fallback until webfont applies
  }
}

export function waitForPageLoad(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}
