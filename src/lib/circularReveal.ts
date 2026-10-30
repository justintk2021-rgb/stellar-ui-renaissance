import { flushSync } from "react-dom";

let revealRunning = false;
let revealAnimation: Animation | null = null;
let revealTimeout = 0;
let activeTransition: { skipTransition?: () => void } | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function circleClipPaths(x: number, y: number): [string, string] {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxRadius = Math.hypot(
    Math.max(x, viewportWidth - x),
    Math.max(y, viewportHeight - y),
  );
  const toX = (value: number) => `${(value / viewportWidth) * 100}%`;
  const toY = (value: number) => `${(value / viewportHeight) * 100}%`;
  const point = `${toX(x)} ${toY(y)}`;
  const toRadius = `${(maxRadius / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`;
  return [
    `circle(0% at ${point})`,
    `circle(${toRadius} at ${point})`,
  ];
}

function clearStuckReveal(): void {
  window.clearTimeout(revealTimeout);
  revealTimeout = 0;
  revealRunning = false;
  revealAnimation?.cancel();
  revealAnimation = null;
  try {
    activeTransition?.skipTransition?.();
  } catch {
    // The view transition may already have finished.
  }
  activeTransition = null;
  const root = document.documentElement;
  delete root.dataset.magicuiThemeVt;
  root.style.removeProperty("--magicui-theme-toggle-vt-duration");
  root.style.removeProperty("--magicui-theme-vt-clip-from");
  root.style.removeProperty("clip-path");
}

/** Circle clip-path reveal used by the notebook / Study Area switch. */
export function circularReveal(
  origin: { x: number, y: number },
  applyChange: () => void,
  options?: { duration?: number },
): void {
  const duration = options?.duration ?? 520;
  const root = document.documentElement;

  if (revealRunning || root.dataset.magicuiThemeVt === "active") {
    clearStuckReveal();
    applyChange();
    return;
  }

  if (prefersReducedMotion() || typeof document.startViewTransition !== "function") {
    applyChange();
    return;
  }

  const clipPath = circleClipPaths(origin.x, origin.y);
  root.dataset.magicuiThemeVt = "active";
  root.style.setProperty("--magicui-theme-toggle-vt-duration", `${duration}ms`);
  root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);

  revealRunning = true;
  revealTimeout = window.setTimeout(clearStuckReveal, duration + 280);

  let transition: ReturnType<NonNullable<Document["startViewTransition"]>>;
  try {
    transition = document.startViewTransition(() => {
      flushSync(applyChange);
    });
    activeTransition = transition;
  } catch {
    clearStuckReveal();
    applyChange();
    return;
  }

  if (typeof transition?.finished?.finally === "function") {
    transition.finished.finally(clearStuckReveal).catch(clearStuckReveal);
  }

  const ready = transition?.ready;
  if (ready && typeof ready.then === "function") {
    ready
      .then(() => {
        revealAnimation = document.documentElement.animate(
          { clipPath },
          {
            duration,
            easing: "ease-in-out",
            fill: "forwards",
            pseudoElement: "::view-transition-new(root)",
          },
        );
        revealAnimation.addEventListener("finish", clearStuckReveal);
      })
      .catch(clearStuckReveal);
  } else {
    clearStuckReveal();
  }
}
