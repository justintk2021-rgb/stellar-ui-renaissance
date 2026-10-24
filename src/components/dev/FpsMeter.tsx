import { useEffect, useRef, useState } from "react";

function fpsEnabled() {
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("fps") === "0") return false;
  if (params.get("fps") === "1") return true;
  return window.localStorage.getItem("nsync-fps") === "1";
}

/** Dev-only FPS overlay. Hidden unless `?fps=1` or localStorage `nsync-fps=1`. */
export function FpsMeter() {
  const [visible, setVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const frame = useRef(0);
  const last = useRef(performance.now());
  const ticks = useRef(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const sync = () => setVisible(fpsEnabled());
    sync();
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "f") {
        const next = window.localStorage.getItem("nsync-fps") === "1" ? "0" : "1";
        window.localStorage.setItem("nsync-fps", next);
        sync();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const loop = (now: number) => {
      ticks.current += 1;
      if (now - last.current >= 500) {
        setFps(Math.round((ticks.current * 1000) / (now - last.current)));
        ticks.current = 0;
        last.current = now;
      }
      frame.current += 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!import.meta.env.DEV || !visible) return null;

  return (
    <div
      hidden={!visible}
      aria-hidden
      data-fps-meter
      className="pointer-events-none fixed bottom-2 left-2 z-[200] rounded-md border border-border/40 bg-background/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground"
    >
      {fps} fps
    </div>
  );
}
