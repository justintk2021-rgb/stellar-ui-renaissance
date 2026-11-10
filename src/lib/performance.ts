export type PerformanceTier = "low" | "medium" | "high";

const STORAGE_KEY = "nsync-perf";

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

function readOverride(): PerformanceTier | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

/**
 * Classify device capability for visual effects.
 * Override anytime: localStorage.setItem("nsync-perf", "low"|"medium"|"high")
 */
export function detectPerformanceTier(): PerformanceTier {
  if (typeof window === "undefined") return "high";

  const override = readOverride();
  if (override) return override;

  const nav = navigator as NavigatorWithHints;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(nav.connection?.saveData);
  const slowNetwork =
    nav.connection?.effectiveType === "slow-2g" ||
    nav.connection?.effectiveType === "2g";
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory;
  const isNarrow = window.matchMedia("(max-width: 768px)").matches;

  if (reducedMotion || saveData || slowNetwork) return "low";
  if (typeof memory === "number" && memory <= 2) return "low";
  if (cores <= 2) return "low";
  if (isNarrow && typeof memory === "number" && memory <= 4) return "low";

  if (typeof memory === "number" && memory <= 4) return "medium";
  if (cores <= 4) return "medium";
  if (isNarrow) return "medium";

  return "high";
}

/** Apply tier to <html> so CSS can strip blur / motion without JS. */
export function applyPerformanceTier(tier: PerformanceTier = detectPerformanceTier()): PerformanceTier {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.perf = tier;
  }
  return tier;
}

export function shouldEnableWebGL(tier: PerformanceTier = detectPerformanceTier()): boolean {
  return tier === "high";
}

export function shouldUseHeavyMotion(tier: PerformanceTier = detectPerformanceTier()): boolean {
  return tier === "high";
}

export function shouldUseLiteMotion(tier: PerformanceTier = detectPerformanceTier()): boolean {
  return tier !== "low";
}
