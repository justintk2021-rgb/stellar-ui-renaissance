import { type RefObject, useEffect, useState } from "react";

/**
 * Pause rAF / infinite motion only when the target is off-screen or the
 * browser tab is hidden. Visible animations stay identical.
 */
export function useAnimationGate(targetRef?: RefObject<Element | null>): {
  active: boolean;
  onScreen: boolean;
  tabVisible: boolean;
} {
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
    active: tabVisible && onScreen,
    onScreen,
    tabVisible,
  };
}
