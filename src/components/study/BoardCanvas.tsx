import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Highlighter, ImagePlus, Minus, MousePointer2, Pencil, Square, Trash2, Type, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Tool = "select" | "pencil" | "marker" | "line" | "ray" | "box" | "text" | "eraser";
type Handle = "nw" | "ne" | "sw" | "se";

type StrokeItem = { id: string; kind: "pencil" | "marker" | "eraser"; points: Point[]; color: string; width: number };
type LineItem = { id: string; kind: "line" | "ray"; a: Point; b: Point; color: string; width: number };
type BoxItem = { id: string; kind: "box"; x: number; y: number; w: number; h: number; color: string; width: number };
type TextItem = { id: string; kind: "text"; x: number; y: number; text: string; color: string; size: number };
type ImageItem = { id: string; kind: "image"; x: number; y: number; w: number; h: number; src: string };
type BoardItem = StrokeItem | LineItem | BoxItem | TextItem | ImageItem;

type Draft =
  | { kind: "stroke"; tool: "pencil" | "marker" | "eraser"; points: Point[] }
  | { kind: "line"; tool: "line" | "ray"; a: Point; b: Point }
  | { kind: "box"; a: Point; b: Point };

const TOOLS: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pencil", label: "Pencil", icon: Pencil },
  { id: "marker", label: "Marker", icon: Highlighter },
  { id: "line", label: "Line", icon: Minus },
  { id: "ray", label: "Ray", icon: Minus },
  { id: "box", label: "Box", icon: Square },
  { id: "text", label: "Text", icon: Type },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

function contentKey(boardId: string) {
  return `nsync-study-board-content-${boardId}`;
}

function uid() {
  return crypto.randomUUID();
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(p.x - x, p.y - y);
}

function extendRay(a: Point, b: Point, width: number, height: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return b;
  let t = Number.POSITIVE_INFINITY;
  if (dx > 0) t = Math.min(t, (width - a.x) / dx);
  else if (dx < 0) t = Math.min(t, (0 - a.x) / dx);
  if (dy > 0) t = Math.min(t, (height - a.y) / dy);
  else if (dy < 0) t = Math.min(t, (0 - a.y) / dy);
  if (!Number.isFinite(t) || t < 1) return b;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - 0.45), to.y - size * Math.sin(angle - 0.45));
  ctx.lineTo(to.x - size * Math.cos(angle + 0.45), to.y - size * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
}

function boundsOf(item: BoardItem, canvas: { width: number; height: number }): { x: number; y: number; w: number; h: number } {
  if (item.kind === "pencil" || item.kind === "marker" || item.kind === "eraser") {
    const xs = item.points.map((p) => p.x);
    const ys = item.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(8, Math.max(...xs) - x), h: Math.max(8, Math.max(...ys) - y) };
  }
  if (item.kind === "line" || item.kind === "ray") {
    const end = item.kind === "ray" ? extendRay(item.a, item.b, canvas.width, canvas.height) : item.b;
    const x = Math.min(item.a.x, end.x);
    const y = Math.min(item.a.y, end.y);
    return { x, y, w: Math.abs(end.x - item.a.x) || 8, h: Math.abs(end.y - item.a.y) || 8 };
  }
  if (item.kind === "box" || item.kind === "image") return { x: item.x, y: item.y, w: item.w, h: item.h };
  return { x: item.x, y: item.y - item.size, w: Math.max(40, item.text.length * item.size * 0.55), h: item.size * 1.3 };
}

function hitItem(item: BoardItem, p: Point, canvas: { width: number; height: number }) {
  const pad = 8;
  if (item.kind === "pencil" || item.kind === "marker" || item.kind === "eraser") {
    for (let i = 1; i < item.points.length; i += 1) {
      if (distToSegment(p, item.points[i - 1], item.points[i]) <= Math.max(pad, item.width)) return true;
    }
    return item.points.some((point) => Math.hypot(point.x - p.x, point.y - p.y) <= Math.max(pad, item.width));
  }
  if (item.kind === "line" || item.kind === "ray") {
    const end = item.kind === "ray" ? extendRay(item.a, item.b, canvas.width, canvas.height) : item.b;
    return distToSegment(p, item.a, end) <= Math.max(pad, item.width);
  }
  const box = boundsOf(item, canvas);
  return p.x >= box.x - pad && p.x <= box.x + box.w + pad && p.y >= box.y - pad && p.y <= box.y + box.h + pad;
}

function moveItem(item: BoardItem, dx: number, dy: number): BoardItem {
  if (item.kind === "pencil" || item.kind === "marker" || item.kind === "eraser") {
    return { ...item, points: item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }
  if (item.kind === "line" || item.kind === "ray") {
    return { ...item, a: { x: item.a.x + dx, y: item.a.y + dy }, b: { x: item.b.x + dx, y: item.b.y + dy } };
  }
  return { ...item, x: item.x + dx, y: item.y + dy };
}

function paintItem(ctx: CanvasRenderingContext2D, item: BoardItem, images: Map<string, HTMLImageElement>, size: { width: number; height: number }) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (item.kind === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = item.width;
    ctx.beginPath();
    item.points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = item.kind === "text" || item.kind === "image" ? item.kind === "text" ? item.color : "#000" : item.color;
  ctx.fillStyle = item.kind === "text" ? item.color : item.kind === "image" ? "#000" : item.color;
  if (item.kind === "marker") ctx.globalAlpha = 0.35;
  if (item.kind === "pencil" || item.kind === "marker") {
    ctx.lineWidth = item.kind === "marker" ? item.width * 2.4 : item.width;
    ctx.beginPath();
    item.points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.stroke();
  } else if (item.kind === "line" || item.kind === "ray") {
    const end = item.kind === "ray" ? extendRay(item.a, item.b, size.width, size.height) : item.b;
    ctx.lineWidth = item.width;
    ctx.beginPath();
    ctx.moveTo(item.a.x, item.a.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (item.kind === "ray") drawArrow(ctx, item.a, end, 10 + item.width);
  } else if (item.kind === "box") {
    ctx.lineWidth = item.width;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
  } else if (item.kind === "text") {
    ctx.globalAlpha = 1;
    ctx.font = `${item.size}px sans-serif`;
    ctx.fillText(item.text, item.x, item.y);
  } else {
    const image = images.get(item.src);
    if (image?.complete) ctx.drawImage(image, item.x, item.y, item.w, item.h);
  }
  ctx.restore();
}

export function BoardCanvas({ boardId, boardName }: { boardId: string; boardName: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const history = useRef<BoardItem[][]>([]);
  const itemsRef = useRef<BoardItem[]>([]);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#111111");
  const [width, setWidth] = useState(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [textDraft, setTextDraft] = useState<{ id: string; x: number; y: number; value: string; creating: boolean } | null>(null);
  const dragRef = useRef<{
    mode: "move" | "resize" | "draw";
    id?: string;
    handle?: Handle;
    origin: Point;
    snapshot: BoardItem;
  } | null>(null);

  itemsRef.current = items;

  const paintRef = useRef<() => void>(() => {});
  const rememberImage = useCallback((src: string) => {
    if (images.current.has(src)) return;
    const image = new Image();
    image.onload = () => {
      images.current.set(src, image);
      paintRef.current();
    };
    image.src = src;
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cssWidth = wrap.clientWidth;
    const cssHeight = wrap.clientHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    const size = { width: cssWidth, height: cssHeight };
    for (const item of itemsRef.current) paintItem(ctx, item, images.current, size);
    if (draft?.kind === "stroke") {
      paintItem(ctx, { id: "draft", kind: draft.tool, points: draft.points, color, width }, images.current, size);
    } else if (draft?.kind === "line") {
      paintItem(ctx, { id: "draft", kind: draft.tool, a: draft.a, b: draft.b, color, width }, images.current, size);
    } else if (draft?.kind === "box") {
      const x = Math.min(draft.a.x, draft.b.x);
      const y = Math.min(draft.a.y, draft.b.y);
      paintItem(ctx, { id: "draft", kind: "box", x, y, w: Math.abs(draft.b.x - draft.a.x), h: Math.abs(draft.b.y - draft.a.y), color, width }, images.current, size);
    }
    const selected = itemsRef.current.find((item) => item.id === selectedId);
    if (selected && selected.kind !== "eraser") {
      const box = boundsOf(selected, size);
      ctx.save();
      ctx.strokeStyle = "hsl(161 93% 30%)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
      ctx.restore();
      if (selected.kind === "image") {
        for (const point of [
          { x: selected.x, y: selected.y },
          { x: selected.x + selected.w, y: selected.y },
          { x: selected.x, y: selected.y + selected.h },
          { x: selected.x + selected.w, y: selected.y + selected.h },
        ]) {
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "hsl(161 93% 30%)";
          ctx.fillRect(point.x - 5, point.y - 5, 10, 10);
          ctx.strokeRect(point.x - 5, point.y - 5, 10, 10);
        }
      }
    }
  }, [color, draft, selectedId, width]);
  paintRef.current = paint;

  useEffect(() => {
    const raw = localStorage.getItem(contentKey(boardId));
    const loaded = raw ? (JSON.parse(raw) as BoardItem[]) : [];
    setItems(Array.isArray(loaded) ? loaded : []);
    setSelectedId(null);
    setDraft(null);
    setTextDraft(null);
    history.current = [];
    loaded.filter((item) => item.kind === "image").forEach((item) => rememberImage(item.src));
  }, [boardId, rememberImage]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(contentKey(boardId), JSON.stringify(items));
      } catch {
        // The drawing stays on screen if storage is full.
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [boardId, items]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = Math.max(1, wrap.clientWidth);
      const cssHeight = Math.max(1, wrap.clientHeight);
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      paint();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => { paint(); }, [paint, items]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const commitItems = (next: BoardItem[]) => {
    history.current.push(itemsRef.current);
    if (history.current.length > 50) history.current.shift();
    setItems(next);
  };

  const finishText = (save: boolean) => {
    setTextDraft((current) => {
      if (!current) return null;
      if (save && current.value.trim()) {
        const size = Math.max(16, width * 6);
        const existing = itemsRef.current.some((item) => item.id === current.id);
        const nextItem: TextItem = { id: current.id, kind: "text", x: current.x, y: current.y + size, text: current.value, color, size };
        commitItems(existing
          ? itemsRef.current.map((item) => item.id === current.id ? { ...nextItem, color: item.kind === "text" ? item.color : color, size: item.kind === "text" ? item.size : size } : item)
          : [...itemsRef.current, nextItem]);
        setSelectedId(current.id);
      }
      return null;
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = pointFromEvent(event);
    const size = { width: wrapRef.current?.clientWidth ?? 1, height: wrapRef.current?.clientHeight ?? 1 };
    if (textDraft) finishText(true);
    if (tool === "text") {
      setTextDraft({ id: uid(), x: p.x, y: p.y, value: "", creating: true });
      return;
    }
    if (tool === "select") {
      const selected = itemsRef.current.find((item) => item.id === selectedId);
      if (selected?.kind === "image") {
        const handles: { id: Handle; x: number; y: number }[] = [
          { id: "nw", x: selected.x, y: selected.y },
          { id: "ne", x: selected.x + selected.w, y: selected.y },
          { id: "sw", x: selected.x, y: selected.y + selected.h },
          { id: "se", x: selected.x + selected.w, y: selected.y + selected.h },
        ];
        const handle = handles.find((corner) => Math.hypot(corner.x - p.x, corner.y - p.y) <= 12);
        if (handle) {
          dragRef.current = { mode: "resize", id: selected.id, handle: handle.id, origin: p, snapshot: selected };
          return;
        }
      }
      const hit = [...itemsRef.current].reverse().find((item) => item.kind !== "eraser" && hitItem(item, p, size));
      setSelectedId(hit?.id ?? null);
      if (hit?.kind === "text") {
        setTextDraft({ id: hit.id, x: hit.x, y: hit.y - hit.size, value: hit.text, creating: false });
        setTool("select");
      }
      if (hit) dragRef.current = { mode: "move", id: hit.id, origin: p, snapshot: hit };
      return;
    }
    if (tool === "pencil" || tool === "marker" || tool === "eraser") setDraft({ kind: "stroke", tool, points: [p] });
    else if (tool === "line" || tool === "ray") setDraft({ kind: "line", tool, a: p, b: p });
    else if (tool === "box") setDraft({ kind: "box", a: p, b: p });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointFromEvent(event);
    const drag = dragRef.current;
    if (drag?.mode === "move" && drag.id) {
      const dx = p.x - drag.origin.x;
      const dy = p.y - drag.origin.y;
      setItems(itemsRef.current.map((item) => item.id === drag.id ? moveItem(drag.snapshot, dx, dy) : item));
      return;
    }
    if (drag?.mode === "resize" && drag.snapshot.kind === "image" && drag.handle) {
      const dx = p.x - drag.origin.x;
      const dy = p.y - drag.origin.y;
      const start = drag.snapshot;
      let { x, y, w, h } = start;
      if (drag.handle.includes("e")) w = start.w + dx;
      if (drag.handle.includes("s")) h = start.h + dy;
      if (drag.handle.includes("w")) { x = start.x + dx; w = start.w - dx; }
      if (drag.handle.includes("n")) { y = start.y + dy; h = start.h - dy; }
      w = Math.max(24, w);
      h = Math.max(24, h);
      setItems(itemsRef.current.map((item) => item.id === start.id && item.kind === "image" ? { ...item, x, y, w, h } : item));
      return;
    }
    setDraft((current) => {
      if (!current) return current;
      if (current.kind === "stroke") return { ...current, points: [...current.points, p] };
      return { ...current, b: p };
    });
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) {
      history.current.push(drag.mode === "move" || drag.mode === "resize" ? itemsRef.current.map((item) => item.id === drag.snapshot.id ? drag.snapshot : item) : itemsRef.current);
      return;
    }
    setDraft((current) => {
      if (!current) return null;
      if (current.kind === "stroke" && current.points.length > 1) {
        commitItems([...itemsRef.current, { id: uid(), kind: current.tool, points: current.points, color, width }]);
      } else if (current.kind === "line") {
        commitItems([...itemsRef.current, { id: uid(), kind: current.tool, a: current.a, b: current.b, color, width }]);
      } else if (current.kind === "box") {
        commitItems([...itemsRef.current, {
          id: uid(),
          kind: "box",
          x: Math.min(current.a.x, current.b.x),
          y: Math.min(current.a.y, current.b.y),
          w: Math.abs(current.b.x - current.a.x),
          h: Math.abs(current.b.y - current.a.y),
          color,
          width,
        }]);
      }
      return null;
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (textDraft) return;
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) {
        event.preventDefault();
        commitItems(itemsRef.current.filter((item) => item.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, textDraft]);

  const addImages = (files: FileList | File[]) => {
    const list = [...files].filter((file) => file.type.startsWith("image/"));
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        if (!src) return;
        rememberImage(src);
        const image = new Image();
        image.onload = () => {
          const max = 360;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          commitItems([...itemsRef.current, {
            id: uid(),
            kind: "image",
            x: 24,
            y: 24,
            w: image.width * scale,
            h: image.height * scale,
            src,
          }]);
        };
        image.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <section className="study-glass flex min-h-[70vh] flex-col rounded-2xl p-4 sm:p-5">
      <h3 className="text-lg font-semibold tracking-tight">{boardName}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {TOOLS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={tool === entry.id}
              onClick={() => setTool(entry.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                tool === entry.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {entry.label}
            </button>
          );
        })}
        <button type="button" onClick={() => { const prev = history.current.pop(); if (prev) setItems(prev); }} className="inline-flex h-8 items-center gap-1 rounded-full bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
        <button type="button" onClick={() => commitItems([])} className="inline-flex h-8 items-center gap-1 rounded-full bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Trash2 className="h-3.5 w-3.5" /> Clear board
        </button>
        <label className="inline-flex h-8 items-center gap-1 rounded-full bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground">
          Color
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
        </label>
        <label className="inline-flex h-8 items-center gap-2 rounded-full bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground">
          Stroke
          <input type="range" min={1} max={24} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
        </label>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ImagePlus className="h-3.5 w-3.5" /> Import image
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => { if (event.target.files) addImages(event.target.files); event.target.value = ""; }} />
        </label>
      </div>
      <div
        ref={wrapRef}
        className="relative mt-3 min-h-[28rem] flex-1 overflow-hidden rounded-xl border border-border/40"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) addImages(event.dataTransfer.files); }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {textDraft && (
          <input
            autoFocus
            value={textDraft.value}
            onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })}
            onBlur={() => finishText(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); finishText(true); }
              if (event.key === "Escape") { event.preventDefault(); setTextDraft(null); }
            }}
            className="absolute border border-dashed border-primary bg-transparent px-1 text-foreground outline-none"
            style={{ left: textDraft.x, top: textDraft.y, fontSize: Math.max(16, width * 6), color }}
          />
        )}
      </div>
    </section>
  );
}
