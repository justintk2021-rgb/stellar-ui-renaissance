import { type RefObject, useEffect, useState } from "react";

/**
 * Combined animation gate: tab visibility, on-screen presence, and
 * prefers-reduced-motion. Use this to pause canvas, beams, and rAF loops.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function useAnimationGate(targetRef?: RefObject<Element | null>): {
  active: boolean;
  reduced: boolean;
  onScreen: boolean;
  tabVisible: boolean;
} {
  const reduced = usePrefersReducedMotion();
  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden,
  );
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const node = targetRef?.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio > 0),
      { threshold: 0.01 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [targetRef]);

  return {
    active: !reduced && tabVisible && onScreen,
    reduced,
    onScreen,
    tabVisible,
  };
}
