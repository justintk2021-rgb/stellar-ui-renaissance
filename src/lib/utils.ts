import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a number to `decimals` places without rounding (e.g. 1.567 → "1.56") */
export function truncateNum(value: number, decimals = 2): string {
  const factor = Math.pow(10, decimals);
  const truncated = Math.trunc(value * factor) / factor;
  return truncated.toFixed(decimals);
}
