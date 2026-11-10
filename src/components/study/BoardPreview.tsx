import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

type PreviewObj = {
  kind: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  text?: string;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  width?: number;
  fontSize?: number;
  mode?: string;
  points?: Point[];
  src?: string;
};

function loadPreview(boardId: string): { objects: PreviewObj[]; background: "white" | "black" } {
  try {
    const raw = localStorage.getItem(`nsync-study-board-content-${boardId}`);
    if (!raw) return { objects: [], background: "white" };
    const parsed = JSON.parse(raw) as {
      objects?: PreviewObj[];
      items?: PreviewObj[];
      background?: string;
    };
    const objects = Array.isArray(parsed.objects)
      ? parsed.objects
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];
    return {
      objects,
      background: parsed.background === "black" ? "black" : "white",
    };
  } catch {
    return { objects: [], background: "white" };
  }
}

function boundsOf(obj: PreviewObj): { x: number; y: number; w: number; h: number } | null {
  if (obj.kind === "stroke" && obj.points?.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of obj.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }
  if (obj.kind === "connector" && obj.x1 != null && obj.y1 != null && obj.x2 != null && obj.y2 != null) {
    const x = Math.min(obj.x1, obj.x2);
    const y = Math.min(obj.y1, obj.y2);
    return { x, y, w: Math.max(1, Math.abs(obj.x2 - obj.x1)), h: Math.max(1, Math.abs(obj.y2 - obj.y1)) };
  }
  if (obj.kind === "text" && obj.x != null && obj.y != null) {
    const size = obj.fontSize ?? 16;
    const w = Math.max(40, (obj.text?.length ?? 1) * size * 0.5);
    return { x: obj.x, y: obj.y - size, w, h: size * 1.4 };
  }
  if (obj.x == null || obj.y == null) return null;
  return {
    x: obj.x,
    y: obj.y,
    w: Math.max(1, obj.w ?? 120),
    h: Math.max(1, obj.h ?? 80),
  };
}

function contentBounds(objects: PreviewObj[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of objects) {
    const b = boundsOf(obj);
    if (!b) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: Math.max(40, maxX - minX), h: Math.max(40, maxY - minY) };
}

/** Thumbnail of a board’s saved canvas content for grid cards. */
export function BoardPreview({
  boardId,
  revision = 0,
  className,
  emptyLabel = "Empty board",
}: {
  boardId: string;
  /** Bump after closing/editing a board so the thumbnail refreshes. */
  revision?: number;
  className?: string;
  emptyLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const paint = () => {
      const { objects, background } = loadPreview(boardId);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w <= 0 || h <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.floor(w * dpr);
      const bh = Math.floor(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = background === "black" ? "#0a0a0a" : "#ffffff";
      ctx.fillRect(0, 0, w, h);

      // Subtle dotted grid
      const spacing = 18;
      ctx.fillStyle = background === "black" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
      for (let x = spacing / 2; x < w; x += spacing) {
        for (let y = spacing / 2; y < h; y += spacing) {
          ctx.fillRect(x, y, 1.2, 1.2);
        }
      }

      const bounds = contentBounds(objects);
      if (!bounds) return;

      const pad = 24;
      const scale = Math.min((w - pad * 2) / bounds.w, (h - pad * 2) / bounds.h, 1.2);
      const ox = (w - bounds.w * scale) / 2 - bounds.x * scale;
      const oy = (h - bounds.h * scale) / 2 - bounds.y * scale;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      for (const obj of objects) {
        if (obj.kind === "sticky" && obj.x != null && obj.y != null) {
          const ww = obj.w ?? 160;
          const hh = obj.h ?? 160;
          ctx.fillStyle = obj.color || "#fef08a";
          ctx.fillRect(obj.x, obj.y, ww, hh);
          ctx.strokeStyle = background === "black" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(obj.x, obj.y, ww, hh);
          if (obj.text) {
            ctx.fillStyle = "#1f2937";
            ctx.font = `${Math.max(10, 12 / scale)}px Inter, system-ui, sans-serif`;
            ctx.textBaseline = "top";
            ctx.fillText(obj.text.split("\n")[0], obj.x + 8, obj.y + 8, ww - 16);
          }
        } else if (obj.kind === "text" && obj.x != null && obj.y != null && obj.text) {
          ctx.fillStyle = obj.color || (background === "black" ? "#f8fafc" : "#111827");
          ctx.font = `${obj.fontSize ?? 18}px Inter, system-ui, sans-serif`;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(obj.text, obj.x, obj.y);
        } else if (obj.kind === "shape" && obj.x != null && obj.y != null) {
          const ww = obj.w ?? 100;
          const hh = obj.h ?? 80;
          ctx.fillStyle = obj.fill || "#10b981";
          ctx.globalAlpha = 0.35;
          ctx.fillRect(obj.x, obj.y, ww, hh);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = obj.stroke || obj.fill || "#10b981";
          ctx.lineWidth = obj.strokeWidth ?? 2;
          ctx.strokeRect(obj.x, obj.y, ww, hh);
        } else if (obj.kind === "connector" && obj.x1 != null && obj.y1 != null && obj.x2 != null && obj.y2 != null) {
          ctx.strokeStyle = obj.color || "#10b981";
          ctx.lineWidth = obj.width ?? 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(obj.x1, obj.y1);
          ctx.lineTo(obj.x2, obj.y2);
          ctx.stroke();
        } else if (obj.kind === "stroke" && obj.points?.length) {
          ctx.strokeStyle = obj.mode === "marker" ? `${obj.color || "#111"}55` : obj.color || "#111";
          ctx.lineWidth = obj.width ?? 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(obj.points[0].x, obj.points[0].y);
          for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
          ctx.stroke();
        } else if (
          (obj.kind === "image" || obj.kind === "video" || obj.kind === "pdf" || obj.kind === "trade" || obj.kind === "note") &&
          obj.x != null &&
          obj.y != null
        ) {
          const ww = obj.w ?? 160;
          const hh = obj.h ?? 100;
          if (obj.kind === "image" && obj.src) {
            // Placeholder; full image decode is skipped for thumbnail cost.
            ctx.fillStyle = background === "black" ? "#1f2937" : "#e5e7eb";
          } else if (obj.kind === "video") {
            ctx.fillStyle = "#111827";
          } else if (obj.kind === "pdf") {
            ctx.fillStyle = background === "black" ? "#1f2937" : "#f1f5f9";
          } else {
            ctx.fillStyle = background === "black" ? "#111827" : "#f8fafc";
          }
          ctx.fillRect(obj.x, obj.y, ww, hh);
          ctx.strokeStyle = background === "black" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(obj.x, obj.y, ww, hh);
        }
      }

      ctx.restore();
    };

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [boardId, revision]);

  const { objects } = loadPreview(boardId);
  const empty = objects.length === 0;

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {empty ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </span>
      ) : null}
    </div>
  );
}
