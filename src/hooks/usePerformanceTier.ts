import { useSyncExternalStore } from "react";
import {
  applyPerformanceTier,
  detectPerformanceTier,
  type PerformanceTier,
} from "@/lib/performance";

let cachedTier: PerformanceTier | null = null;
const listeners = new Set<() => void>();

function getTier(): PerformanceTier {
  if (cachedTier) return cachedTier;
  cachedTier = applyPerformanceTier(detectPerformanceTier());
  return cachedTier;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Current performance tier (`low` | `medium` | `high`). Stable for the session. */
export function usePerformanceTier(): PerformanceTier {
  return useSyncExternalStore(subscribe, getTier, () => "high");
}

export function usePrefersLiteVisuals(): boolean {
  return usePerformanceTier() !== "high";
}

export function usePrefersMinimalVisuals(): boolean {
  return usePerformanceTier() === "low";
}
