/** Lightweight CSS starfield — safe on low-end devices (no WebGL). */
export function CssStarfield() {
  return (
    <div className="app-starfield" aria-hidden>
      <div className="app-starfield-glow" aria-hidden />
    </div>
  );
}
