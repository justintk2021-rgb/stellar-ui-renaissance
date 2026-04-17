import { useEffect, useRef, useState, useMemo } from "react";

interface GreetingProps {
  name?: string | null;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: GreetingProps) {
  const [greeting, setGreeting] = useState<string>(() => getTimeGreeting());
  const textRef = useRef<SVGTextElement | null>(null);
  const [pathLen, setPathLen] = useState<number>(1200);
  const [penX, setPenX] = useState<number>(0);
  const [textWidth, setTextWidth] = useState<number>(600);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = getTimeGreeting();
      setGreeting((prev) => (prev !== next ? next : prev));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fullText = useMemo(() => {
    const trimmed = (name || "").trim();
    return trimmed ? `${greeting}, ${trimmed}` : greeting;
  }, [greeting, name]);

  // Measure the text after it renders to size the SVG and pen travel
  useEffect(() => {
    if (!textRef.current) return;
    // Defer so fonts/layout settle
    const id = requestAnimationFrame(() => {
      try {
        const bbox = textRef.current!.getBBox();
        // Approximate stroke length (rough — character count * avg stroke per glyph)
        const approxStroke = Math.max(bbox.width * 2.4, 600);
        setPathLen(approxStroke);
        setTextWidth(bbox.width);
      } catch {
        // ignore
      }
    });
    return () => cancelAnimationFrame(id);
  }, [fullText]);

  // Animate pen travel left -> right in sync with the stroke reveal
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 2200; // ms — matches CSS animation duration below
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / duration);
      // Ease-in-out
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setPenX(eased * textWidth);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fullText, textWidth]);

  // Re-mount on text change to retrigger the stroke animation
  const animKey = fullText;

  // Estimate SVG viewBox based on text length
  const svgWidth = Math.max(textWidth + 40, 320);
  const svgHeight = 64;
  const baselineY = 44;

  return (
    <div
      className="mb-2 select-none"
      aria-label={fullText}
      style={{ minHeight: svgHeight }}
    >
      <svg
        key={animKey}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          <style>{`
            @keyframes greeting-draw {
              from { stroke-dashoffset: ${pathLen}; }
              to { stroke-dashoffset: 0; }
            }
            .greeting-text-stroke {
              fill: transparent;
              stroke: hsl(var(--primary));
              stroke-width: 1.25;
              stroke-linecap: round;
              stroke-linejoin: round;
              stroke-dasharray: ${pathLen};
              stroke-dashoffset: ${pathLen};
              animation: greeting-draw 2.2s cubic-bezier(0.65, 0, 0.35, 1) forwards;
              font-family: 'Dancing Script', 'Lora', 'Georgia', cursive;
              font-style: italic;
              font-size: 34px;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .greeting-text-fill {
              fill: hsl(var(--primary));
              opacity: 0;
              animation: greeting-fill 2.6s ease-out forwards;
              font-family: 'Dancing Script', 'Lora', 'Georgia', cursive;
              font-style: italic;
              font-size: 34px;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            @keyframes greeting-fill {
              0%, 80% { opacity: 0; }
              100% { opacity: 0.92; }
            }
            @keyframes greeting-pen-fade {
              0%, 90% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </defs>

        {/* Stroke layer (the "ink" being drawn) */}
        <text
          ref={textRef}
          x={0}
          y={baselineY}
          className="greeting-text-stroke"
        >
          {fullText}
        </text>

        {/* Fill layer that fades in once the stroke completes */}
        <text x={0} y={baselineY} className="greeting-text-fill">
          {fullText}
        </text>

        {/* Pen tip following the stroke */}
        <g
          transform={`translate(${penX}, ${baselineY})`}
          style={{
            animation: "greeting-pen-fade 2.6s ease-out forwards",
            transformBox: "fill-box",
          }}
        >
          {/* Pen body — angled like a fountain pen */}
          <g transform="rotate(-35)">
            <rect
              x={0}
              y={-18}
              width={3}
              height={18}
              rx={1.5}
              fill="hsl(var(--primary))"
              opacity={0.9}
            />
            <rect
              x={-0.5}
              y={-26}
              width={4}
              height={9}
              rx={1}
              fill="hsl(var(--foreground))"
              opacity={0.55}
            />
            {/* Nib tip */}
            <circle cx={1.5} cy={1} r={1.4} fill="hsl(var(--primary))" />
          </g>
        </g>
      </svg>
    </div>
  );
}
