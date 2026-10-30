import { flushSync } from "react-dom";

let revealRunning = false;
let revealAnimation: Animation | null = null;

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

/** Circle clip-path reveal used by the theme toggle. */
export function circularReveal(
  origin: { x: number; y: number },
  applyChange: () => void,
  options?: { duration?: number },
): void {
  const duration = options?.duration ?? 520;
  const root = document.documentElement;

  if (revealRunning || root.dataset.magicuiThemeVt === "active") return;

  if (prefersReducedMotion() || typeof document.startViewTransition !== "function") {
    applyChange();
    return;
  }

  const clipPath = circleClipPaths(origin.x, origin.y);
  root.dataset.magicuiThemeVt = "active";
  root.style.setProperty("--magicui-theme-toggle-vt-duration", `${duration}ms`);
  root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);

  const cleanup = () => {
    revealRunning = false;
    revealAnimation?.cancel();
    revealAnimation = null;
    delete root.dataset.magicuiThemeVt;
    root.style.removeProperty("--magicui-theme-toggle-vt-duration");
    root.style.removeProperty("--magicui-theme-vt-clip-from");
  };

  revealRunning = true;
  let transition: ReturnType<NonNullable<Document["startViewTransition"]>>;
  try {
    transition = document.startViewTransition(() => {
      flushSync(applyChange);
    });
  } catch {
    cleanup();
    applyChange();
    return;
  }

  window.setTimeout(cleanup, duration + 400);

  if (typeof transition?.finished?.finally === "function") {
    transition.finished.finally(cleanup).catch(cleanup);
  } else {
    cleanup();
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
      })
      .catch(cleanup);
  } else {
    cleanup();
  }
}
