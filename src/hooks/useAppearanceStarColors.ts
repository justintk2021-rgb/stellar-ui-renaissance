import { useCallback, useEffect, useState } from "react";
import { hslComponentsToHex } from "@/lib/colorUtils";

export interface StarfieldColors {
  /** Neutral star specks */
  starWhite: string;
  /** Accent-tinted particles (primary) */
  accentPrimary: string;
  /** Secondary glow (primary-glow / secondary) */
  accentGlow: string;
  isLight: boolean;
}

function readCssHslVar(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

function hslVarToHex(hslTriplet: string, fallbackHex: string): string {
  const match = hslTriplet.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return fallbackHex;
  return hslComponentsToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

function readStarfieldColors(): StarfieldColors {
  const root = document.documentElement;
  const isLight = root.classList.contains("light");
  const primary = readCssHslVar("--primary", "158 64% 51%");
  const glow = readCssHslVar("--primary-glow", primary);
  const secondary = readCssHslVar("--secondary", glow);

  return {
    starWhite: isLight ? "#64748b" : "#ffffff",
    accentPrimary: hslVarToHex(primary, "#10b981"),
    accentGlow: hslVarToHex(glow, hslVarToHex(secondary, "#34d399")),
    isLight,
  };
}

/**
 * Keeps starfield (CSS + WebGL) in sync with theme, accent presets, and custom colors.
 */
export function useAppearanceStarColors(): StarfieldColors {
  const [colors, setColors] = useState<StarfieldColors>(() =>
    typeof document !== "undefined"
      ? readStarfieldColors()
      : {
          starWhite: "#ffffff",
          accentPrimary: "#10b981",
          accentGlow: "#34d399",
          isLight: false,
        }
  );

  const sync = useCallback(() => {
    setColors(readStarfieldColors());
  }, []);

  useEffect(() => {
    sync();
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("storage", sync);
    window.addEventListener("appearance-change", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", sync);
      window.removeEventListener("appearance-change", sync);
    };
  }, [sync]);

  return colors;
}
