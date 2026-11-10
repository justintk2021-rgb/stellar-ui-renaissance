import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Eraser,
  FileText,
  Film,
  FolderOpen,
  GripVertical,
  Hand,
  Highlighter,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  Search,
  Shapes,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  ArrowLeft,
  BookMarked,
  NotebookPen,
  Youtube,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isUnjournaledTrade } from "@/lib/notifications";
import { formatPnL, getTradeNetResult } from "@/lib/tradeFormat";
import { formatStudyTradeWhen, studyDocPlainText } from "@/lib/studyArea";
import type { NotebookEntry, Trade } from "@/types/trade";
import type { StudyNote } from "@/hooks/useStudyArea";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { StudyTradeCard } from "./StudyTradeCard";
import type { StudyPlaybook } from "./studyEditorData";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Tool =
  | "select"
  | "hand"
  | "sticky"
  | "text"
  | "shape"
  | "connector"
  | "pen"
  | "marker"
  | "eraser";

type ShapeKind =
  | "rect"
  | "rounded-rect"
  | "ellipse"
  | "circle"
  | "diamond"
  | "triangle"
  | "triangle-down"
  | "triangle-left"
  | "triangle-right"
  | "parallelogram"
  | "trapezoid"
  | "pentagon"
  | "hexagon"
  | "heptagon"
  | "octagon"
  | "star"
  | "star-6"
  | "cross"
  | "plus"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "chevron-right"
  | "chevron-left"
  | "heart"
  | "cloud"
  | "cylinder"
  | "callout"
  | "donut"
  | "semicircle"
  | "document"
  | "database"
  | "process";

type Point = { x: number; y: number };
type Camera = { x: number; y: number; zoom: number };

type StickyObj = {
  id: string;
  kind: "sticky";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
};

type TextObj = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

type ShapeObj = {
  id: string;
  kind: "shape";
  shape: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

type ConnectorObj = {
  id: string;
  kind: "connector";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  arrow: boolean;
};

type StrokeObj = {
  id: string;
  kind: "stroke";
  mode: "pen" | "marker";
  points: Point[];
  color: string;
  width: number;
};

type ImageObj = {
  id: string;
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};

type VideoObj = {
  id: string;
  kind: "video";
  x: number;
  y: number;
  w: number;
  h: number;
  source: "upload" | "youtube";
  src: string;
  title: string;
  youtubeId?: string;
};

type PdfObj = {
  id: string;
  kind: "pdf";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  title: string;
};

type TradeObj = {
  id: string;
  kind: "trade";
  tradeId: string;
  x: number;
  y: number;
  /** Screen-space CSS width — does not scale with canvas zoom. */
  w: number;
  /** Screen-space CSS height — does not scale with canvas zoom. */
  h: number;
};

type NoteObj = {
  id: string;
  kind: "note";
  source: "study" | "notebook";
  noteId: string;
  x: number;
  y: number;
  /** Screen-space CSS width — does not scale with canvas zoom. */
  w: number;
  /** Screen-space CSS height — does not scale with canvas zoom. */
  h: number;
};

type BoardObj = StickyObj | TextObj | ShapeObj | ConnectorObj | StrokeObj | ImageObj | VideoObj | PdfObj | TradeObj | NoteObj;

function notebookPlainText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isScreenCard(obj: BoardObj): obj is TradeObj | NoteObj {
  return obj.kind === "trade" || obj.kind === "note";
}

type BoardBackground = "white" | "black";

type BoardContent = {
  version: 2;
  camera?: Camera;
  background?: BoardBackground;
  objects: BoardObj[];
};

type Corner = "nw" | "ne" | "sw" | "se";

type DragMode =
  | { type: "pan"; last: Point }
  | { type: "marquee"; start: Point; current: Point }
  | { type: "move"; ids: string[]; last: Point }
  | { type: "resize"; id: string; corner: Corner; start: Point; orig: BoardObj }
  | { type: "draw-shape"; id: string }
  | { type: "draw-connector"; id: string }
  | { type: "draw-stroke"; id: string }
  | { type: "erase" }
  | null;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const HANDLE = 7;
const DEFAULT_STICKY_COLOR = "#fef08a";
/** Trade/note cards stay this CSS size on screen regardless of canvas zoom. */
const TRADE_CARD_SCREEN_W = 300;
const TRADE_CARD_SCREEN_H = 180;
const NOTE_CARD_SCREEN_W = 300;
const NOTE_CARD_SCREEN_H = 180;
const STICKY_PRESET_COLORS = [
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#fbcfe8", // pink
  "#fdba74", // orange
  "#e9d5ff", // purple
  "#fecaca", // red
  "#e5e7eb", // gray
];

function storageKey(boardId: string) {
  return `nsync-study-board-content-${boardId}`;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function loadBoard(boardId: string): { objects: BoardObj[]; camera: Camera; background: BoardBackground } {
  try {
    const raw = localStorage.getItem(storageKey(boardId));
    if (!raw) return { objects: [], camera: { x: 0, y: 0, zoom: 1 }, background: "white" };
    const parsed = JSON.parse(raw) as BoardContent & { items?: BoardObj[] };
    const objects = Array.isArray(parsed.objects)
      ? parsed.objects
      : Array.isArray(parsed.items)
        ? (parsed.items as BoardObj[])
        : [];
    const camera =
      parsed.camera && typeof parsed.camera.zoom === "number"
        ? {
            x: parsed.camera.x || 0,
            y: parsed.camera.y || 0,
            zoom: clamp(parsed.camera.zoom, MIN_ZOOM, MAX_ZOOM),
          }
        : { x: 0, y: 0, zoom: 1 };
    const background: BoardBackground = parsed.background === "black" ? "black" : "white";
    return { objects, camera, background };
  } catch {
    return { objects: [], camera: { x: 0, y: 0, zoom: 1 }, background: "white" };
  }
}

function saveBoard(boardId: string, objects: BoardObj[], camera: Camera, background: BoardBackground) {
  const payload: BoardContent = { version: 2, objects, camera, background };
  localStorage.setItem(storageKey(boardId), JSON.stringify(payload));
}

function worldToScreen(p: Point, cam: Camera): Point {
  return { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y };
}

function screenToWorld(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom };
}

function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
        const id = url.pathname.split("/").filter(Boolean)[1];
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      const v = url.searchParams.get("v");
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
  } catch {
    return null;
  }
  return null;
}

function boundsOf(obj: BoardObj, zoom = 1): { x: number; y: number; w: number; h: number } | null {
  if (isScreenCard(obj)) {
    const z = Math.max(zoom, 0.0001);
    return { x: obj.x, y: obj.y, w: obj.w / z, h: obj.h / z };
  }
  if (obj.kind === "sticky" || obj.kind === "shape" || obj.kind === "image" || obj.kind === "video" || obj.kind === "pdf") {
    return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
  }
  if (obj.kind === "text") {
    const w = Math.max(48, obj.text.length * obj.fontSize * 0.55);
    const h = obj.fontSize * 1.4;
    return { x: obj.x, y: obj.y - h + 4, w, h };
  }
  if (obj.kind === "connector") {
    return {
      x: Math.min(obj.x1, obj.x2),
      y: Math.min(obj.y1, obj.y2),
      w: Math.abs(obj.x2 - obj.x1) || 1,
      h: Math.abs(obj.y2 - obj.y1) || 1,
    };
  }
  if (obj.kind === "stroke" && obj.points.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of obj.points) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    const pad = obj.width;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  return null;
}

function pointInRect(p: Point, r: { x: number; y: number; w: number; h: number }, pad = 0) {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
}

function nearSegment(p: Point, a: Point, b: Point, tol: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a) <= tol;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy }) <= tol;
}

function hitTest(objects: BoardObj[], world: Point, zoom = 1): string | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.kind === "stroke") {
      const tol = Math.max(6, obj.width + 4);
      for (let j = 1; j < obj.points.length; j++) {
        if (nearSegment(world, obj.points[j - 1], obj.points[j], tol)) return obj.id;
      }
      if (obj.points.length === 1 && dist(world, obj.points[0]) <= tol) return obj.id;
      continue;
    }
    if (obj.kind === "connector") {
      if (nearSegment(world, { x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }, Math.max(6, obj.width + 4))) {
        return obj.id;
      }
      continue;
    }
    const b = boundsOf(obj, zoom);
    if (b && pointInRect(world, b, 2)) return obj.id;
  }
  return null;
}

function hitCorner(obj: BoardObj, world: Point, zoom: number): Corner | null {
  const b = boundsOf(obj, zoom);
  if (!b || obj.kind === "stroke" || obj.kind === "connector" || obj.kind === "text") return null;
  const tol = (HANDLE + 4) / zoom;
  const corners: Record<Corner, Point> = {
    nw: { x: b.x, y: b.y },
    ne: { x: b.x + b.w, y: b.y },
    sw: { x: b.x, y: b.y + b.h },
    se: { x: b.x + b.w, y: b.y + b.h },
  };
  for (const key of Object.keys(corners) as Corner[]) {
    if (dist(world, corners[key]) <= tol) return key;
  }
  return null;
}

function moveObj(obj: BoardObj, dx: number, dy: number): BoardObj {
  if (obj.kind === "stroke") {
    return { ...obj, points: obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  if (obj.kind === "connector") {
    return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy };
  }
  if (obj.kind === "text") return { ...obj, x: obj.x + dx, y: obj.y + dy };
  return { ...obj, x: obj.x + dx, y: obj.y + dy };
}

/** Mutate in place during live drag to avoid allocating every pointer move. */
function moveObjInPlace(obj: BoardObj, dx: number, dy: number) {
  if (obj.kind === "stroke") {
    for (const p of obj.points) {
      p.x += dx;
      p.y += dy;
    }
    return;
  }
  if (obj.kind === "connector") {
    obj.x1 += dx;
    obj.y1 += dy;
    obj.x2 += dx;
    obj.y2 += dy;
    return;
  }
  obj.x += dx;
  obj.y += dy;
}

function overlapsView(
  b: { x: number; y: number; w: number; h: number },
  view: { x: number; y: number; w: number; h: number },
) {
  return b.x < view.x + view.w && b.x + b.w > view.x && b.y < view.y + view.h && b.y + b.h > view.y;
}

function resizeObj(orig: BoardObj, corner: Corner, world: Point, zoom = 1): BoardObj {
  if (
    orig.kind !== "sticky" &&
    orig.kind !== "shape" &&
    orig.kind !== "image" &&
    orig.kind !== "video" &&
    orig.kind !== "pdf" &&
    orig.kind !== "trade" &&
    orig.kind !== "note"
  ) {
    return orig;
  }

  // Trade/note cards store CSS/screen size; convert to world for the drag math, then back.
  if (isScreenCard(orig)) {
    const z = Math.max(zoom, 0.0001);
    let x = orig.x;
    let y = orig.y;
    let w = orig.w / z;
    let h = orig.h / z;
    const min = 140 / z;
    if (corner === "se") {
      w = Math.max(min, world.x - x);
      h = Math.max(min, world.y - y);
    } else if (corner === "ne") {
      w = Math.max(min, world.x - x);
      const bottom = y + h;
      h = Math.max(min, bottom - world.y);
      y = bottom - h;
    } else if (corner === "sw") {
      const right = x + w;
      w = Math.max(min, right - world.x);
      x = right - w;
      h = Math.max(min, world.y - y);
    } else {
      const right = x + w;
      const bottom = y + h;
      w = Math.max(min, right - world.x);
      h = Math.max(min, bottom - world.y);
      x = right - w;
      y = bottom - h;
    }
    return {
      ...orig,
      x,
      y,
      w: Math.max(140, w * z),
      h: Math.max(120, h * z),
    };
  }

  let { x, y, w, h } = orig;
  const min = 24;
  if (corner === "se") {
    w = Math.max(min, world.x - x);
    h = Math.max(min, world.y - y);
  } else if (corner === "ne") {
    w = Math.max(min, world.x - x);
    const bottom = y + h;
    h = Math.max(min, bottom - world.y);
    y = bottom - h;
  } else if (corner === "sw") {
    const right = x + w;
    w = Math.max(min, right - world.x);
    x = right - w;
    h = Math.max(min, world.y - y);
  } else {
    const right = x + w;
    const bottom = y + h;
    w = Math.max(min, right - world.x);
    h = Math.max(min, bottom - world.y);
    x = right - w;
    y = bottom - h;
  }
  return { ...orig, x, y, w, h };
}

function contentBounds(objects: BoardObj[], zoom = 1) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of objects) {
    const b = boundsOf(obj, zoom);
    if (!b) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = Math.max(10, width * 3.2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 7), to.y - size * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 7), to.y - size * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

function hexAlpha(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function regularPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
  rotation = -Math.PI / 2,
) {
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    const px = cx + rx * Math.cos(a);
    const py = cy + ry * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function starPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
  inner = 0.45,
) {
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? 1 : inner;
    const px = cx + rx * r * Math.cos(a);
    const py = cy + ry * r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function paintShapePath(ctx: CanvasRenderingContext2D, obj: ShapeObj) {
  const { x, y, w, h, shape } = obj;
  const aw = Math.abs(w);
  const ah = Math.abs(h);
  const left = w < 0 ? x + w : x;
  const top = h < 0 ? y + h : y;
  const cx = left + aw / 2;
  const cy = top + ah / 2;
  const rx = aw / 2;
  const ry = ah / 2;

  ctx.beginPath();
  switch (shape) {
    case "rect":
      ctx.rect(left, top, aw, ah);
      break;
    case "rounded-rect": {
      const r = Math.min(aw, ah) * 0.18;
      ctx.moveTo(left + r, top);
      ctx.arcTo(left + aw, top, left + aw, top + ah, r);
      ctx.arcTo(left + aw, top + ah, left, top + ah, r);
      ctx.arcTo(left, top + ah, left, top, r);
      ctx.arcTo(left, top, left + aw, top, r);
      ctx.closePath();
      break;
    }
    case "ellipse":
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      break;
    case "circle": {
      const r = Math.min(rx, ry);
      ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
      break;
    }
    case "diamond":
      ctx.moveTo(cx, top);
      ctx.lineTo(left + aw, cy);
      ctx.lineTo(cx, top + ah);
      ctx.lineTo(left, cy);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(cx, top);
      ctx.lineTo(left + aw, top + ah);
      ctx.lineTo(left, top + ah);
      ctx.closePath();
      break;
    case "triangle-down":
      ctx.moveTo(left, top);
      ctx.lineTo(left + aw, top);
      ctx.lineTo(cx, top + ah);
      ctx.closePath();
      break;
    case "triangle-left":
      ctx.moveTo(left + aw, top);
      ctx.lineTo(left + aw, top + ah);
      ctx.lineTo(left, cy);
      ctx.closePath();
      break;
    case "triangle-right":
      ctx.moveTo(left, top);
      ctx.lineTo(left + aw, cy);
      ctx.lineTo(left, top + ah);
      ctx.closePath();
      break;
    case "parallelogram":
      ctx.moveTo(left + aw * 0.25, top);
      ctx.lineTo(left + aw, top);
      ctx.lineTo(left + aw * 0.75, top + ah);
      ctx.lineTo(left, top + ah);
      ctx.closePath();
      break;
    case "trapezoid":
      ctx.moveTo(left + aw * 0.2, top);
      ctx.lineTo(left + aw * 0.8, top);
      ctx.lineTo(left + aw, top + ah);
      ctx.lineTo(left, top + ah);
      ctx.closePath();
      break;
    case "pentagon":
      regularPolygon(ctx, cx, cy, rx, ry, 5);
      break;
    case "hexagon":
      regularPolygon(ctx, cx, cy, rx, ry, 6);
      break;
    case "heptagon":
      regularPolygon(ctx, cx, cy, rx, ry, 7);
      break;
    case "octagon":
      regularPolygon(ctx, cx, cy, rx, ry, 8);
      break;
    case "star":
      starPolygon(ctx, cx, cy, rx, ry, 5);
      break;
    case "star-6":
      starPolygon(ctx, cx, cy, rx, ry, 6, 0.5);
      break;
    case "cross":
      ctx.moveTo(left + aw * 0.35, top);
      ctx.lineTo(left + aw * 0.65, top);
      ctx.lineTo(left + aw * 0.65, top + ah * 0.35);
      ctx.lineTo(left + aw, top + ah * 0.35);
      ctx.lineTo(left + aw, top + ah * 0.65);
      ctx.lineTo(left + aw * 0.65, top + ah * 0.65);
      ctx.lineTo(left + aw * 0.65, top + ah);
      ctx.lineTo(left + aw * 0.35, top + ah);
      ctx.lineTo(left + aw * 0.35, top + ah * 0.65);
      ctx.lineTo(left, top + ah * 0.65);
      ctx.lineTo(left, top + ah * 0.35);
      ctx.lineTo(left + aw * 0.35, top + ah * 0.35);
      ctx.closePath();
      break;
    case "plus":
      ctx.moveTo(left + aw * 0.38, top);
      ctx.lineTo(left + aw * 0.62, top);
      ctx.lineTo(left + aw * 0.62, top + ah * 0.38);
      ctx.lineTo(left + aw, top + ah * 0.38);
      ctx.lineTo(left + aw, top + ah * 0.62);
      ctx.lineTo(left + aw * 0.62, top + ah * 0.62);
      ctx.lineTo(left + aw * 0.62, top + ah);
      ctx.lineTo(left + aw * 0.38, top + ah);
      ctx.lineTo(left + aw * 0.38, top + ah * 0.62);
      ctx.lineTo(left, top + ah * 0.62);
      ctx.lineTo(left, top + ah * 0.38);
      ctx.lineTo(left + aw * 0.38, top + ah * 0.38);
      ctx.closePath();
      break;
    case "arrow-right":
      ctx.moveTo(left, top + ah * 0.3);
      ctx.lineTo(left + aw * 0.55, top + ah * 0.3);
      ctx.lineTo(left + aw * 0.55, top);
      ctx.lineTo(left + aw, cy);
      ctx.lineTo(left + aw * 0.55, top + ah);
      ctx.lineTo(left + aw * 0.55, top + ah * 0.7);
      ctx.lineTo(left, top + ah * 0.7);
      ctx.closePath();
      break;
    case "arrow-left":
      ctx.moveTo(left + aw, top + ah * 0.3);
      ctx.lineTo(left + aw * 0.45, top + ah * 0.3);
      ctx.lineTo(left + aw * 0.45, top);
      ctx.lineTo(left, cy);
      ctx.lineTo(left + aw * 0.45, top + ah);
      ctx.lineTo(left + aw * 0.45, top + ah * 0.7);
      ctx.lineTo(left + aw, top + ah * 0.7);
      ctx.closePath();
      break;
    case "arrow-up":
      ctx.moveTo(left + aw * 0.3, top + ah);
      ctx.lineTo(left + aw * 0.3, top + ah * 0.45);
      ctx.lineTo(left, top + ah * 0.45);
      ctx.lineTo(cx, top);
      ctx.lineTo(left + aw, top + ah * 0.45);
      ctx.lineTo(left + aw * 0.7, top + ah * 0.45);
      ctx.lineTo(left + aw * 0.7, top + ah);
      ctx.closePath();
      break;
    case "arrow-down":
      ctx.moveTo(left + aw * 0.3, top);
      ctx.lineTo(left + aw * 0.3, top + ah * 0.55);
      ctx.lineTo(left, top + ah * 0.55);
      ctx.lineTo(cx, top + ah);
      ctx.lineTo(left + aw, top + ah * 0.55);
      ctx.lineTo(left + aw * 0.7, top + ah * 0.55);
      ctx.lineTo(left + aw * 0.7, top);
      ctx.closePath();
      break;
    case "chevron-right":
      ctx.moveTo(left, top);
      ctx.lineTo(left + aw * 0.65, top);
      ctx.lineTo(left + aw, cy);
      ctx.lineTo(left + aw * 0.65, top + ah);
      ctx.lineTo(left, top + ah);
      ctx.lineTo(left + aw * 0.35, cy);
      ctx.closePath();
      break;
    case "chevron-left":
      ctx.moveTo(left + aw, top);
      ctx.lineTo(left + aw * 0.35, top);
      ctx.lineTo(left, cy);
      ctx.lineTo(left + aw * 0.35, top + ah);
      ctx.lineTo(left + aw, top + ah);
      ctx.lineTo(left + aw * 0.65, cy);
      ctx.closePath();
      break;
    case "heart":
      ctx.moveTo(cx, top + ah * 0.35);
      ctx.bezierCurveTo(cx, top + ah * 0.1, left + aw * 0.1, top, left + aw * 0.25, top + ah * 0.2);
      ctx.bezierCurveTo(left, top + ah * 0.35, left + aw * 0.1, top + ah * 0.65, cx, top + ah);
      ctx.bezierCurveTo(left + aw * 0.9, top + ah * 0.65, left + aw, top + ah * 0.35, left + aw * 0.75, top + ah * 0.2);
      ctx.bezierCurveTo(left + aw * 0.9, top, cx, top + ah * 0.1, cx, top + ah * 0.35);
      ctx.closePath();
      break;
    case "cloud":
      ctx.moveTo(left + aw * 0.25, top + ah * 0.6);
      ctx.bezierCurveTo(left, top + ah * 0.6, left, top + ah * 0.35, left + aw * 0.22, top + ah * 0.32);
      ctx.bezierCurveTo(left + aw * 0.22, top, left + aw * 0.55, top, left + aw * 0.58, top + ah * 0.28);
      ctx.bezierCurveTo(left + aw * 0.78, top + ah * 0.05, left + aw, top + ah * 0.25, left + aw * 0.9, top + ah * 0.45);
      ctx.bezierCurveTo(left + aw, top + ah * 0.55, left + aw * 0.85, top + ah * 0.78, left + aw * 0.6, top + ah * 0.75);
      ctx.bezierCurveTo(left + aw * 0.5, top + ah * 0.95, left + aw * 0.2, top + ah * 0.85, left + aw * 0.25, top + ah * 0.6);
      ctx.closePath();
      break;
    case "cylinder":
      ctx.moveTo(left, top + ah * 0.18);
      ctx.ellipse(cx, top + ah * 0.18, rx, ah * 0.18, 0, Math.PI, 0);
      ctx.lineTo(left + aw, top + ah * 0.82);
      ctx.ellipse(cx, top + ah * 0.82, rx, ah * 0.18, 0, 0, Math.PI);
      ctx.closePath();
      break;
    case "callout":
      ctx.moveTo(left + aw * 0.08, top);
      ctx.lineTo(left + aw * 0.92, top);
      ctx.quadraticCurveTo(left + aw, top, left + aw, top + ah * 0.1);
      ctx.lineTo(left + aw, top + ah * 0.62);
      ctx.quadraticCurveTo(left + aw, top + ah * 0.72, left + aw * 0.92, top + ah * 0.72);
      ctx.lineTo(left + aw * 0.42, top + ah * 0.72);
      ctx.lineTo(left + aw * 0.22, top + ah);
      ctx.lineTo(left + aw * 0.3, top + ah * 0.72);
      ctx.lineTo(left + aw * 0.08, top + ah * 0.72);
      ctx.quadraticCurveTo(left, top + ah * 0.72, left, top + ah * 0.62);
      ctx.lineTo(left, top + ah * 0.1);
      ctx.quadraticCurveTo(left, top, left + aw * 0.08, top);
      ctx.closePath();
      break;
    case "donut":
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.moveTo(cx + rx * 0.45, cy);
      ctx.ellipse(cx, cy, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2, true);
      break;
    case "semicircle":
      ctx.moveTo(left, top + ah);
      ctx.lineTo(left + aw, top + ah);
      ctx.ellipse(cx, top + ah, rx, ah, 0, 0, Math.PI, true);
      ctx.closePath();
      break;
    case "document":
      ctx.moveTo(left, top);
      ctx.lineTo(left + aw * 0.7, top);
      ctx.lineTo(left + aw, top + ah * 0.22);
      ctx.lineTo(left + aw, top + ah);
      ctx.lineTo(left, top + ah);
      ctx.closePath();
      break;
    case "database":
      ctx.moveTo(left, top + ah * 0.2);
      ctx.ellipse(cx, top + ah * 0.2, rx, ah * 0.2, 0, Math.PI, 0, true);
      ctx.lineTo(left + aw, top + ah * 0.8);
      ctx.ellipse(cx, top + ah * 0.8, rx, ah * 0.2, 0, 0, Math.PI);
      ctx.closePath();
      break;
    case "process":
      ctx.moveTo(left + aw * 0.15, top);
      ctx.lineTo(left + aw, top);
      ctx.lineTo(left + aw * 0.85, top + ah);
      ctx.lineTo(left, top + ah);
      ctx.closePath();
      break;
    default:
      ctx.rect(left, top, aw, ah);
  }
}

type ShapeCatalogItem = {
  id: ShapeKind;
  label: string;
  keywords: string;
  category: string;
};

const SHAPE_CATALOG: ShapeCatalogItem[] = [
  { id: "rect", label: "Rectangle", keywords: "square box", category: "Basic" },
  { id: "rounded-rect", label: "Rounded rectangle", keywords: "round soft box", category: "Basic" },
  { id: "ellipse", label: "Ellipse", keywords: "oval", category: "Basic" },
  { id: "circle", label: "Circle", keywords: "round", category: "Basic" },
  { id: "diamond", label: "Diamond", keywords: "rhombus decision", category: "Basic" },
  { id: "triangle", label: "Triangle", keywords: "up", category: "Basic" },
  { id: "triangle-down", label: "Triangle down", keywords: "down invert", category: "Basic" },
  { id: "triangle-left", label: "Triangle left", keywords: "left", category: "Basic" },
  { id: "triangle-right", label: "Triangle right", keywords: "right", category: "Basic" },
  { id: "parallelogram", label: "Parallelogram", keywords: "slant data", category: "Flowchart" },
  { id: "trapezoid", label: "Trapezoid", keywords: "manual input", category: "Flowchart" },
  { id: "process", label: "Process", keywords: "flowchart step", category: "Flowchart" },
  { id: "document", label: "Document", keywords: "page file paper", category: "Flowchart" },
  { id: "database", label: "Database", keywords: "storage data cylinder", category: "Flowchart" },
  { id: "cylinder", label: "Cylinder", keywords: "3d tube", category: "Flowchart" },
  { id: "callout", label: "Callout", keywords: "speech bubble comment", category: "Flowchart" },
  { id: "pentagon", label: "Pentagon", keywords: "5 sides", category: "Polygons" },
  { id: "hexagon", label: "Hexagon", keywords: "6 sides", category: "Polygons" },
  { id: "heptagon", label: "Heptagon", keywords: "7 sides", category: "Polygons" },
  { id: "octagon", label: "Octagon", keywords: "8 sides stop", category: "Polygons" },
  { id: "star", label: "Star", keywords: "5 point favorite", category: "Symbols" },
  { id: "star-6", label: "6-point star", keywords: "hexagram", category: "Symbols" },
  { id: "cross", label: "Cross", keywords: "x medical", category: "Symbols" },
  { id: "plus", label: "Plus", keywords: "add cross", category: "Symbols" },
  { id: "heart", label: "Heart", keywords: "love like", category: "Symbols" },
  { id: "cloud", label: "Cloud", keywords: "weather sky", category: "Symbols" },
  { id: "donut", label: "Donut", keywords: "ring circle hole", category: "Symbols" },
  { id: "semicircle", label: "Semicircle", keywords: "half moon arch", category: "Symbols" },
  { id: "arrow-right", label: "Arrow right", keywords: "direction next", category: "Arrows" },
  { id: "arrow-left", label: "Arrow left", keywords: "direction back", category: "Arrows" },
  { id: "arrow-up", label: "Arrow up", keywords: "direction", category: "Arrows" },
  { id: "arrow-down", label: "Arrow down", keywords: "direction", category: "Arrows" },
  { id: "chevron-right", label: "Chevron right", keywords: "bracket", category: "Arrows" },
  { id: "chevron-left", label: "Chevron left", keywords: "bracket", category: "Arrows" },
];

function ShapePreview({ shape }: { shape: ShapeKind }) {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 text-foreground" aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
        d={SHAPE_PREVIEW_PATHS[shape] ?? "M8 8h24v24H8z"}
      />
    </svg>
  );
}

/** Compact preview paths for the shapes picker */
const SHAPE_PREVIEW_PATHS: Partial<Record<ShapeKind, string>> = {
  rect: "M8 10h24v20H8z",
  "rounded-rect": "M12 10h16a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z",
  ellipse: "M20 8c8 0 14 5.4 14 12s-6 12-14 12S6 26.6 6 20 12 8 20 8z",
  circle: "M20 8a12 12 0 1 1 0 24 12 12 0 0 1 0-24z",
  diamond: "M20 6l14 14-14 14L6 20z",
  triangle: "M20 7l14 26H6z",
  "triangle-down": "M6 7h28L20 33z",
  "triangle-left": "M34 7v26L6 20z",
  "triangle-right": "M6 7v26l28-13z",
  parallelogram: "M12 10h22l-6 20H6z",
  trapezoid: "M12 10h16l6 20H6z",
  process: "M10 10h24l-4 20H6z",
  document: "M10 8h14l6 6v18H10z",
  database: "M8 12c0-3 5.4-5 12-5s12 2 12 5v16c0 3-5.4 5-12 5s-12-2-12-5z",
  cylinder: "M8 12c0-3 5.4-5 12-5s12 2 12 5v16c0 3-5.4 5-12 5s-12-2-12-5z",
  callout: "M8 8h24v16H18l-6 8v-8H8z",
  pentagon: "M20 6l14 11-5 15H11l-5-15z",
  hexagon: "M12 8h16l8 12-8 12H12L4 20z",
  heptagon: "M20 5l12 6 4 12-8 11H12L4 23l4-12z",
  octagon: "M14 6h12l8 8v12l-8 8H14l-8-8V14z",
  star: "M20 6l3.5 9H34l-8 6 3 10-9-6-9 6 3-10-8-6h10.5z",
  "star-6": "M20 5l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z",
  cross: "M16 6h8v10h10v8H24v10h-8V24H6v-8h10z",
  plus: "M17 6h6v11h11v6H23v11h-6V23H6v-6h11z",
  heart: "M20 34S6 24 6 15c0-5 4-8 8-8 3 0 5 2 6 4 1-2 3-4 6-4 4 0 8 3 8 8 0 9-14 19-14 19z",
  cloud: "M12 26c-4 0-6-3-6-6s3-6 7-5c1-4 5-7 10-7 6 0 10 4 10 9 4 0 7 3 7 6s-3 3-3 3H12z",
  donut: "M20 8a12 12 0 1 1 0 24 12 12 0 0 1 0-24zm0 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  semicircle: "M6 28h28A14 14 0 0 0 6 28z",
  "arrow-right": "M6 14h16V8l12 12-12 12v-6H6z",
  "arrow-left": "M34 14H18V8L6 20l12 12v-6h16z",
  "arrow-up": "M14 34V18H8L20 6l12 12h-6v16z",
  "arrow-down": "M14 6v16H8l12 12 12-12h-6V6z",
  "chevron-right": "M8 8h16l8 12-8 12H8l8-12z",
  "chevron-left": "M32 8H16L8 20l8 12h16l-8-12z",
};

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const TOOLS: { id: Tool; label: string; shortcut?: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Select", shortcut: "Alt+S", icon: MousePointer2 },
  { id: "hand", label: "Hand", shortcut: "Alt+H", icon: Hand },
  { id: "sticky", label: "Sticky", shortcut: "S", icon: StickyNote },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "connector", label: "Connector", shortcut: "L", icon: Minus },
  { id: "pen", label: "Pen", icon: Pencil },
  { id: "marker", label: "Marker", icon: Highlighter },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
];

export function BoardCanvas({
  boardId,
  boardName,
  trades = [],
  playbooks = [],
  studyNotes = [],
  notebookEntries = [],
  onOpenJournal,
  onOpenStudyNote,
  onRenameBoard,
  onClose,
}: {
  boardId: string;
  boardName: string;
  trades?: Trade[];
  playbooks?: StudyPlaybook[];
  studyNotes?: StudyNote[];
  notebookEntries?: NotebookEntry[];
  onOpenJournal?: (tradeId: string) => void;
  onOpenStudyNote?: (noteId: string) => void;
  onRenameBoard?: (nextName: string) => void;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const objectsRef = useRef<BoardObj[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const selectedRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<BoardObj[][]>([]);
  const futureRef = useRef<BoardObj[][]>([]);
  const dragRef = useRef<DragMode>(null);
  const spaceDown = useRef(false);
  const rightPanRef = useRef(false);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ dist: number; zoom: number; mid: Point } | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const saveTimer = useRef<number | null>(null);
  const connectorArrow = useRef(true);
  const backgroundRef = useRef<BoardBackground>("white");
  const rafRef = useRef<number | null>(null);
  const cameraUiTimer = useRef<number | null>(null);
  const cameraDirtyRef = useRef(false);
  const strokeLiveRef = useRef<StrokeObj | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const mediaLayerRef = useRef<HTMLDivElement>(null);
  const textDraftRef = useRef<{
    id: string | null;
    x: number;
    y: number;
    value: string;
    kind: "text" | "sticky";
    editing: boolean;
  } | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const toolRef = useRef<Tool>("select");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const shapeKindRef = useRef<ShapeKind>("rect");
  const [shapesOpen, setShapesOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [tradeQuery, setTradeQuery] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");
  const [noteSourceFilter, setNoteSourceFilter] = useState<"all" | "study" | "notebook">("all");
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardNameDraft, setBoardNameDraft] = useState(boardName);
  const boardNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingBoardName) setBoardNameDraft(boardName);
  }, [boardName, editingBoardName]);

  useEffect(() => {
    if (!editingBoardName) return;
    const input = boardNameInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editingBoardName]);

  const commitBoardName = useCallback(() => {
    const next = boardNameDraft.trim();
    setEditingBoardName(false);
    if (!next || next === boardName) {
      setBoardNameDraft(boardName);
      return;
    }
    onRenameBoard?.(next);
  }, [boardName, boardNameDraft, onRenameBoard]);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [shapeQuery, setShapeQuery] = useState("");
  const [color, setColor] = useState("#10b981");
  const colorRef = useRef("#10b981");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const strokeWidthRef = useRef(3);
  const [background, setBackground] = useState<BoardBackground>("white");
  const [stickyColor, setStickyColor] = useState(DEFAULT_STICKY_COLOR);
  const stickyColorRef = useRef(DEFAULT_STICKY_COLOR);
  const stickyPickActiveRef = useRef(false);
  const stickySwatchRef = useRef<HTMLLabelElement>(null);
  const stickyHexRef = useRef<HTMLInputElement>(null);
  const stickyColorInputRef = useRef<HTMLInputElement>(null);
  const toolPanelRef = useRef<HTMLDivElement>(null);
  const toolPanelDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);
  const [objects, setObjects] = useState<BoardObj[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [toolPanelPos, setToolPanelPos] = useState<{ left: number; top: number } | null>(null);
  const [hoveredMediaId, setHoveredMediaId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<{
    id: string | null;
    x: number;
    y: number;
    value: string;
    kind: "text" | "sticky";
    editing: boolean;
  } | null>(null);
  textDraftRef.current = textDraft;

  const setToolBoth = (next: Tool) => {
    toolRef.current = next;
    setTool(next);
  };

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveBoard(boardId, objectsRef.current, cameraRef.current, backgroundRef.current);
    }, 400);
  }, [boardId]);

  // Flush pending save when leaving the board
  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cameraUiTimer.current) window.clearTimeout(cameraUiTimer.current);
      saveBoard(boardId, objectsRef.current, cameraRef.current, backgroundRef.current);
    };
  }, [boardId]);

  const applyBackground = useCallback(
    (next: BoardBackground) => {
      backgroundRef.current = next;
      setBackground(next);
      saveBoard(boardId, objectsRef.current, cameraRef.current, next);
    },
    [boardId],
  );

  const pushHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-39),
      objectsRef.current.map((o) => structuredClone(o)),
    ];
    futureRef.current = [];
  }, []);

  const commitObjects = useCallback(
    (next: BoardObj[] | ((prev: BoardObj[]) => BoardObj[]), record = true) => {
      setObjects((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (record) pushHistory();
        objectsRef.current = resolved;
        scheduleSave();
        return resolved;
      });
    },
    [pushHistory, scheduleSave],
  );

  const updateZoomLabel = useCallback(() => {
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(cameraRef.current.zoom * 100)}%`;
    }
  }, []);

  /** Sync React camera state only when UI that depends on it needs it (text draft). */
  const syncCameraUi = useCallback(() => {
    if (!textDraftRef.current) return;
    if (cameraUiTimer.current) return;
    cameraUiTimer.current = window.setTimeout(() => {
      cameraUiTimer.current = null;
      setCamera({ ...cameraRef.current });
    }, 100);
  }, []);

  const flushCamera = useCallback(() => {
    if (cameraUiTimer.current) {
      window.clearTimeout(cameraUiTimer.current);
      cameraUiTimer.current = null;
    }
    updateZoomLabel();
    setCamera({ ...cameraRef.current });
    if (cameraDirtyRef.current) {
      cameraDirtyRef.current = false;
      scheduleSave();
    }
  }, [scheduleSave, updateZoomLabel]);

  /** Live camera update — canvas redraw only; no React re-render / localStorage every frame */
  const setCameraLive = useCallback(
    (next: Camera | ((prev: Camera) => Camera)) => {
      const prev = cameraRef.current;
      const resolved = typeof next === "function" ? next(prev) : next;
      const zoom = clamp(resolved.zoom, MIN_ZOOM, MAX_ZOOM);
      cameraRef.current = { ...resolved, zoom };
      cameraDirtyRef.current = true;
      if (zoom !== prev.zoom) updateZoomLabel();
      syncCameraUi();
    },
    [syncCameraUi, updateZoomLabel],
  );

  const updateCamera = useCallback(
    (next: Camera | ((prev: Camera) => Camera)) => {
      setCameraLive(next);
      flushCamera();
    },
    [flushCamera, setCameraLive],
  );

  const setSelection = useCallback((ids: string[]) => {
    selectedRef.current = new Set(ids);
    setSelectedIds(ids);
    const sticky = objectsRef.current.find((obj) => ids.includes(obj.id) && obj.kind === "sticky");
    if (sticky && sticky.kind === "sticky") {
      stickyColorRef.current = sticky.color;
      setStickyColor(sticky.color);
      if (stickySwatchRef.current) stickySwatchRef.current.style.background = sticky.color;
      if (stickyColorInputRef.current) stickyColorInputRef.current.value = sticky.color;
      if (stickyHexRef.current && document.activeElement !== stickyHexRef.current) {
        stickyHexRef.current.value = sticky.color;
      }
    }
  }, []);

  // Load board
  useEffect(() => {
    const loaded = loadBoard(boardId);
    objectsRef.current = loaded.objects;
    cameraRef.current = loaded.camera;
    backgroundRef.current = loaded.background;
    historyRef.current = [];
    futureRef.current = [];
    setObjects(loaded.objects);
    setCamera(loaded.camera);
    setBackground(loaded.background);
    setSelection([]);
    setTextDraft(null);
    setToolBoth("select");
  }, [boardId, setSelection]);

  // Image / media thumbnail cache
  useEffect(() => {
    for (const obj of objects) {
      if (imageCache.current.has(obj.id)) continue;
      if (obj.kind === "image") {
        const img = new Image();
        img.onload = () => setSize((s) => ({ ...s }));
        img.src = obj.src;
        imageCache.current.set(obj.id, img);
      } else if (obj.kind === "video" && obj.source === "youtube" && obj.youtubeId) {
        const img = new Image();
        img.onload = () => setSize((s) => ({ ...s }));
        img.referrerPolicy = "no-referrer";
        img.src = `https://img.youtube.com/vi/${obj.youtubeId}/hqdefault.jpg`;
        imageCache.current.set(obj.id, img);
      }
    }
  }, [objects]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;

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

    const bg = backgroundRef.current;
    ctx.fillStyle = bg === "black" ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const cam = cameraRef.current;

    // Screen-space dotted grid — fillRect is much cheaper than arc paths
    let spacing = 28 * cam.zoom;
    while (spacing < 12) spacing *= 2;
    const dot = spacing < 18 ? 1.25 : 1.75;
    let ox = cam.x % spacing;
    let oy = cam.y % spacing;
    if (ox < 0) ox += spacing;
    if (oy < 0) oy += spacing;
    ctx.fillStyle = bg === "black" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)";
    for (let x = ox; x <= w; x += spacing) {
      for (let y = oy; y <= h; y += spacing) {
        ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      }
    }

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    const pad = 80 / cam.zoom;
    const view = {
      x: -cam.x / cam.zoom - pad,
      y: -cam.y / cam.zoom - pad,
      w: w / cam.zoom + pad * 2,
      h: h / cam.zoom + pad * 2,
    };

    for (const obj of objectsRef.current) {
      const b = boundsOf(obj, cam.zoom);
      if (b && !overlapsView(b, view)) continue;

      if (obj.kind === "sticky") {
        ctx.fillStyle = obj.color;
        ctx.strokeStyle = bg === "black" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1 / cam.zoom;
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        if (obj.text && cam.zoom > 0.35) {
          ctx.fillStyle = "#1f2937";
          ctx.font = `${14 / cam.zoom}px Inter, system-ui, sans-serif`;
          ctx.textBaseline = "top";
          const maxW = obj.w - 16;
          const lines = obj.text.split("\n");
          const lineH = 18 / cam.zoom;
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], obj.x + 10, obj.y + 10 + i * lineH, maxW);
          }
        }
      } else if (obj.kind === "text") {
        ctx.fillStyle = obj.color;
        ctx.font = `${obj.fontSize}px Inter, system-ui, sans-serif`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(obj.text, obj.x, obj.y);
      } else if (obj.kind === "shape") {
        paintShapePath(ctx, obj);
        ctx.fillStyle = hexAlpha(obj.fill, 0.35);
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.fill(obj.shape === "donut" ? "evenodd" : "nonzero");
        ctx.stroke();
      } else if (obj.kind === "connector") {
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();
        if (obj.arrow) drawArrow(ctx, { x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }, obj.color, obj.width);
      } else if (obj.kind === "stroke") {
        if (obj.points.length === 0) continue;
        ctx.strokeStyle = obj.mode === "marker" ? hexAlpha(obj.color, 0.35) : obj.color;
        ctx.lineWidth = obj.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
        if (obj.points.length === 1) ctx.lineTo(obj.points[0].x + 0.01, obj.points[0].y);
        ctx.stroke();
      } else if (obj.kind === "image") {
        const img = imageCache.current.get(obj.id);
        if (img?.complete) ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
        else {
          ctx.fillStyle = bg === "black" ? "#1f2937" : "#e5e7eb";
          ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        }
      } else if (obj.kind === "video") {
        // HTML video overlays sit on top and keep playing; draw a simple underlay for hit area.
        ctx.fillStyle = "#111827";
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      } else if (obj.kind === "pdf") {
        // HTML PDF overlays sit on top for in-canvas preview; draw a simple underlay.
        ctx.fillStyle = bg === "black" ? "#1f2937" : "#f1f5f9";
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      } else if ((obj.kind === "trade" || obj.kind === "note") && b) {
        // Screen-locked card — underlay matches overlay hit area in world units.
        ctx.fillStyle = bg === "black" ? "#111827" : "#f8fafc";
        ctx.strokeStyle = bg === "black" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1 / cam.zoom;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    }

    // Selection chrome
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.strokeStyle = "#10b981";
    ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
    for (const id of selectedRef.current) {
      const obj = objectsRef.current.find((o) => o.id === id);
      if (!obj) continue;
      const b = boundsOf(obj, cam.zoom);
      if (!b) continue;
      ctx.strokeRect(b.x - 2 / cam.zoom, b.y - 2 / cam.zoom, b.w + 4 / cam.zoom, b.h + 4 / cam.zoom);
      if (
        obj.kind === "sticky" ||
        obj.kind === "shape" ||
        obj.kind === "image" ||
        obj.kind === "video" ||
        obj.kind === "pdf" ||
        obj.kind === "trade" ||
        obj.kind === "note"
      ) {
        ctx.setLineDash([]);
        ctx.fillStyle = "#10b981";
        const hs = HANDLE / cam.zoom;
        for (const c of [
          { x: b.x, y: b.y },
          { x: b.x + b.w, y: b.y },
          { x: b.x, y: b.y + b.h },
          { x: b.x + b.w, y: b.y + b.h },
        ]) {
          ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
        }
        ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
      }
    }
    ctx.setLineDash([]);

    // Marquee in world space
    const drag = dragRef.current;
    if (drag?.type === "marquee") {
      const x = Math.min(drag.start.x, drag.current.x);
      const y = Math.min(drag.start.y, drag.current.y);
      const mw = Math.abs(drag.current.x - drag.start.x);
      const mh = Math.abs(drag.current.y - drag.start.y);
      ctx.fillStyle = "rgba(16,185,129,0.12)";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1 / cam.zoom;
      ctx.fillRect(x, y, mw, mh);
      ctx.strokeRect(x, y, mw, mh);
    }

    ctx.restore();

    // Keep video/PDF overlays locked to world positions without remounting.
    const mediaRoot = mediaLayerRef.current;
    if (mediaRoot) {
      const nodes = mediaRoot.querySelectorAll<HTMLElement>("[data-media-id]");
      const media = new Map(
        objectsRef.current
          .filter(
            (o): o is VideoObj | PdfObj | TradeObj | NoteObj =>
              o.kind === "video" || o.kind === "pdf" || o.kind === "trade" || o.kind === "note",
          )
          .map((o) => [o.id, o]),
      );
      nodes.forEach((node) => {
        const id = node.dataset.mediaId;
        if (!id) return;
        const obj = media.get(id);
        if (!obj) {
          node.style.visibility = "hidden";
          return;
        }
        const screen = worldToScreen({ x: obj.x, y: obj.y }, cam);
        node.style.visibility = "visible";
        node.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
        // Trade/note cards keep a fixed on-screen size (user-resizable); video/PDF scale with zoom.
        if (obj.kind === "trade" || obj.kind === "note") {
          node.style.width = `${Math.max(1, obj.w)}px`;
          node.style.height = `${Math.max(1, obj.h)}px`;
        } else {
          node.style.width = `${Math.max(1, obj.w * cam.zoom)}px`;
          node.style.height = `${Math.max(1, obj.h * cam.zoom)}px`;
        }
      });
    }
  }, []);

  const requestRedraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redraw();
    });
  }, [redraw]);

  const syncStickyColorUi = useCallback((next: string) => {
    stickyColorRef.current = next;
    if (stickySwatchRef.current) stickySwatchRef.current.style.background = next;
    if (stickyColorInputRef.current && stickyColorInputRef.current.value !== next) {
      stickyColorInputRef.current.value = next;
    }
    if (stickyHexRef.current && document.activeElement !== stickyHexRef.current) {
      stickyHexRef.current.value = next;
    }
  }, []);

  /** Live color-picker scrubbing: mutate + redraw only (no React / history / save). */
  const previewStickyColor = useCallback(
    (next: string) => {
      if (!stickyPickActiveRef.current) {
        stickyPickActiveRef.current = true;
        let hasSticky = false;
        for (const id of selectedRef.current) {
          const obj = objectsRef.current.find((o) => o.id === id);
          if (obj?.kind === "sticky") {
            hasSticky = true;
            break;
          }
        }
        if (hasSticky) pushHistory();
      }
      syncStickyColorUi(next);
      let changed = false;
      for (const obj of objectsRef.current) {
        if (selectedRef.current.has(obj.id) && obj.kind === "sticky" && obj.color !== next) {
          obj.color = next;
          changed = true;
        }
      }
      if (changed) requestRedraw();
    },
    [pushHistory, requestRedraw, syncStickyColorUi],
  );

  /** Commit after picker closes / preset click / valid hex entry. */
  const commitStickyColor = useCallback(
    (next: string, recordHistory = true) => {
      stickyPickActiveRef.current = false;
      syncStickyColorUi(next);
      setStickyColor(next);
      if (!selectedRef.current.size) return;
      if (!recordHistory) {
        for (const obj of objectsRef.current) {
          if (selectedRef.current.has(obj.id) && obj.kind === "sticky") obj.color = next;
        }
        setObjects(objectsRef.current.slice());
        scheduleSave();
        requestRedraw();
        return;
      }
      commitObjects(
        (prev) =>
          prev.map((obj) =>
            selectedRef.current.has(obj.id) && obj.kind === "sticky" ? { ...obj, color: next } : obj,
          ),
        true,
      );
    },
    [commitObjects, requestRedraw, scheduleSave, syncStickyColorUi],
  );

  const applyStickyColor = useCallback(
    (next: string) => {
      const alreadyRecorded = stickyPickActiveRef.current;
      stickyPickActiveRef.current = false;
      commitStickyColor(next, !alreadyRecorded);
    },
    [commitStickyColor],
  );

  const endStickyColorPick = useCallback(() => {
    const next = stickyColorRef.current;
    if (!stickyPickActiveRef.current) {
      setStickyColor(next);
      return;
    }
    commitStickyColor(next, false);
  }, [commitStickyColor]);

  useEffect(() => {
    requestRedraw();
  }, [objects, selectedIds, size, textDraft, background, requestRedraw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setSize({ w: wrap.clientWidth, h: wrap.clientHeight }));
    ro.observe(wrap);
    setSize({ w: wrap.clientWidth, h: wrap.clientHeight });
    return () => ro.disconnect();
  }, []);

  const screenPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRectRef.current ?? canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const zoomAt = useCallback(
    (screen: Point, nextZoom: number) => {
      const cam = cameraRef.current;
      const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const world = screenToWorld(screen, cam);
      setCameraLive({
        zoom: z,
        x: screen.x - world.x * z,
        y: screen.y - world.y * z,
      });
      requestRedraw();
    },
    [requestRedraw, setCameraLive],
  );

  const fitToContent = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const bounds = contentBounds(objectsRef.current, cameraRef.current.zoom);
    if (!bounds) {
      updateCamera({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2, zoom: 1 });
      return;
    }
    const pad = 64;
    const zx = (wrap.clientWidth - pad * 2) / Math.max(bounds.w, 1);
    const zy = (wrap.clientHeight - pad * 2) / Math.max(bounds.h, 1);
    const zoom = clamp(Math.min(zx, zy), MIN_ZOOM, MAX_ZOOM);
    updateCamera({
      zoom,
      x: wrap.clientWidth / 2 - (bounds.x + bounds.w / 2) * zoom,
      y: wrap.clientHeight / 2 - (bounds.y + bounds.h / 2) * zoom,
    });
  }, [updateCamera]);

  const undo = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(objectsRef.current.map((o) => structuredClone(o)));
    objectsRef.current = prev;
    setObjects(prev);
    setSelection([]);
    scheduleSave();
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(objectsRef.current.map((o) => structuredClone(o)));
    objectsRef.current = next;
    setObjects(next);
    setSelection([]);
    scheduleSave();
  };

  const clearBoard = useCallback(() => {
    if (!objectsRef.current.length) return;
    if (!window.confirm("Clear the entire board? All shapes, notes, and drawings will be removed.")) return;
    commitObjects([], true);
    setSelection([]);
    requestRedraw();
  }, [commitObjects, requestRedraw, setSelection]);

  const duplicateSelected = () => {
    if (!selectedRef.current.size) return;
    pushHistory();
    const clones: BoardObj[] = [];
    const newIds: string[] = [];
    for (const obj of objectsRef.current) {
      if (!selectedRef.current.has(obj.id)) continue;
      const clone = structuredClone(moveObj(obj, 24, 24)) as BoardObj;
      clone.id = uid();
      clones.push(clone);
      newIds.push(clone.id);
      if (clone.kind === "image" || clone.kind === "video") {
        const img = imageCache.current.get(obj.id);
        if (img) imageCache.current.set(clone.id, img);
      }
    }
    objectsRef.current = [...objectsRef.current, ...clones];
    setObjects(objectsRef.current);
    setSelection(newIds);
    scheduleSave();
  };

  const deleteSelected = useCallback(() => {
    if (!selectedRef.current.size || textDraft) return;
    pushHistory();
    objectsRef.current = objectsRef.current.filter((o) => !selectedRef.current.has(o.id));
    setObjects(objectsRef.current.slice());
    setSelection([]);
    scheduleSave();
    requestRedraw();
  }, [pushHistory, requestRedraw, scheduleSave, setSelection, textDraft]);

  const applyStyleToSelection = (nextColor: string, nextWidth: number) => {
    if (!selectedRef.current.size) return;
    commitObjects(
      (prev) =>
        prev.map((obj) => {
          if (!selectedRef.current.has(obj.id)) return obj;
          if (obj.kind === "text") return { ...obj, color: nextColor };
          if (obj.kind === "shape") return { ...obj, fill: nextColor, stroke: nextColor, strokeWidth: nextWidth };
          if (obj.kind === "connector") return { ...obj, color: nextColor, width: nextWidth };
          if (obj.kind === "stroke") return { ...obj, color: nextColor, width: nextWidth };
          if (obj.kind === "sticky") return { ...obj, color: nextColor };
          return obj;
        }),
      true,
    );
  };

  // Keyboard
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (event.target as HTMLElement)?.isContentEditable;
      if (event.code === "Space" && !typing) {
        spaceDown.current = true;
        event.preventDefault();
        return;
      }
      if (event.key === "Escape") {
        if (editingBoardName) {
          setBoardNameDraft(boardName);
          setEditingBoardName(false);
          return;
        }
        if (textDraft) {
          setTextDraft(null);
          return;
        }
        if (shapesOpen) {
          setShapesOpen(false);
          return;
        }
        if (resourcesOpen) {
          setResourcesOpen(false);
          return;
        }
        if (tradesOpen) {
          setTradesOpen(false);
          return;
        }
        if (notesOpen) {
          setNotesOpen(false);
          return;
        }
        event.preventDefault();
        onClose();
        return;
      }
      if (typing || textDraft) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (meta && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (meta && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection(objectsRef.current.map((o) => o.id));
        return;
      }
      if (meta && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        const wrap = wrapRef.current;
        if (!wrap) return;
        zoomAt({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }, cameraRef.current.zoom * 1.15);
        return;
      }
      if (meta && event.key === "-") {
        event.preventDefault();
        const wrap = wrapRef.current;
        if (!wrap) return;
        zoomAt({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }, cameraRef.current.zoom / 1.15);
        return;
      }
      if (meta && event.key === "0") {
        event.preventDefault();
        const wrap = wrapRef.current;
        if (!wrap) return;
        zoomAt({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }, 1);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (event.altKey && event.code === "KeyS") {
        event.preventDefault();
        setToolBoth("select");
        return;
      }
      if (event.altKey && event.code === "KeyH") {
        event.preventDefault();
        setToolBoth("hand");
        return;
      }
      if (!event.altKey && event.code === "KeyS") setToolBoth("sticky");
      if (!event.altKey && event.code === "KeyT") setToolBoth("text");
      if (!event.altKey && event.code === "KeyL") setToolBoth("connector");
      if (!event.altKey && event.code === "KeyE") setToolBoth("eraser");
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [boardName, deleteSelected, editingBoardName, notesOpen, onClose, resourcesOpen, shapesOpen, textDraft, tradesOpen]);

  useEffect(() => {
    if (textDraft) requestAnimationFrame(() => textRef.current?.focus());
  }, [textDraft]);

  const eraseAt = (world: Point) => {
    const hit = hitTest(objectsRef.current, world, cameraRef.current.zoom);
    const obj = objectsRef.current.find((o) => o.id === hit);
    if (obj?.kind === "stroke") {
      objectsRef.current = objectsRef.current.filter((o) => o.id !== obj.id);
      requestRedraw();
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (textDraft) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    canvasRectRef.current = canvas.getBoundingClientRect();

    const screen = screenPoint(event);
    pointersRef.current.set(event.pointerId, screen);

    // Two-finger pinch / pan
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      pinchRef.current = { dist: dist(pts[0], pts[1]), zoom: cameraRef.current.zoom, mid };
      dragRef.current = { type: "pan", last: mid };
      return;
    }

    const world = screenToWorld(screen, cameraRef.current);
    const activeTool = toolRef.current;

    // Right-click hold, middle-click, Space, or Hand tool → pan anytime
    const wantsPan =
      event.button === 2 ||
      event.button === 1 ||
      spaceDown.current ||
      activeTool === "hand";

    if (wantsPan) {
      if (event.button === 2) rightPanRef.current = true;
      canvas.style.cursor = "grabbing";
      dragRef.current = { type: "pan", last: screen };
      return;
    }

    if (activeTool === "select") {
      const selected = [...selectedRef.current]
        .map((id) => objectsRef.current.find((o) => o.id === id))
        .filter(Boolean) as BoardObj[];
      if (selected.length === 1) {
        const corner = hitCorner(selected[0], world, cameraRef.current.zoom);
        if (corner) {
          pushHistory();
          dragRef.current = { type: "resize", id: selected[0].id, corner, start: world, orig: structuredClone(selected[0]) };
          return;
        }
      }
      const hit = hitTest(objectsRef.current, world, cameraRef.current.zoom);
      if (hit) {
        const ids = event.shiftKey
          ? selectedRef.current.has(hit)
            ? [...selectedRef.current].filter((id) => id !== hit)
            : [...selectedRef.current, hit]
          : selectedRef.current.has(hit)
            ? [...selectedRef.current]
            : [hit];
        setSelection(ids);
        pushHistory();
        dragRef.current = { type: "move", ids, last: world };
      } else {
        setSelection([]);
        dragRef.current = { type: "marquee", start: world, current: world };
      }
      return;
    }

    if (activeTool === "sticky") {
      const id = uid();
      const note: StickyObj = {
        id,
        kind: "sticky",
        x: world.x,
        y: world.y,
        w: 180,
        h: 160,
        text: "",
        color: stickyColorRef.current,
      };
      commitObjects((prev) => [...prev, note], true);
      setSelection([id]);
      setTextDraft({
        id,
        x: world.x,
        y: world.y,
        value: "",
        kind: "sticky",
        editing: true,
      });
      return;
    }

    if (activeTool === "text") {
      setSelection([]);
      setTextDraft({
        id: null,
        x: world.x,
        y: world.y,
        value: "",
        kind: "text",
        editing: false,
      });
      return;
    }

    if (activeTool === "shape") {
      const id = uid();
      const shape: ShapeObj = {
        id,
        kind: "shape",
        shape: shapeKindRef.current,
        x: world.x,
        y: world.y,
        w: 1,
        h: 1,
        fill: colorRef.current,
        stroke: colorRef.current,
        strokeWidth: strokeWidthRef.current,
      };
      dragRef.current = { type: "draw-shape", id };
      commitObjects((prev) => [...prev, shape], true);
      setSelection([id]);
      return;
    }

    if (activeTool === "connector") {
      const id = uid();
      const connector: ConnectorObj = {
        id,
        kind: "connector",
        x1: world.x,
        y1: world.y,
        x2: world.x,
        y2: world.y,
        color: colorRef.current,
        width: strokeWidthRef.current,
        arrow: connectorArrow.current,
      };
      dragRef.current = { type: "draw-connector", id };
      commitObjects((prev) => [...prev, connector], true);
      setSelection([id]);
      return;
    }

    if (activeTool === "pen" || activeTool === "marker") {
      const id = uid();
      const stroke: StrokeObj = {
        id,
        kind: "stroke",
        mode: activeTool,
        points: [world],
        color: colorRef.current,
        width: activeTool === "marker" ? strokeWidthRef.current * 2.6 : strokeWidthRef.current,
      };
      strokeLiveRef.current = stroke;
      dragRef.current = { type: "draw-stroke", id };
      pushHistory();
      objectsRef.current = [...objectsRef.current, stroke];
      requestRedraw();
      return;
    }

    if (activeTool === "eraser") {
      pushHistory();
      dragRef.current = { type: "erase" };
      eraseAt(world);
      return;
    }

    // Default touch pan for non-drawing tools
    if (event.pointerType === "touch") {
      dragRef.current = { type: "pan", last: screen };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const screen = screenPoint(event);
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, screen);
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const d = dist(pts[0], pts[1]);
      const scale = d / Math.max(pinchRef.current.dist, 1);
      zoomAt(mid, pinchRef.current.zoom * scale);
      const drag = dragRef.current;
      if (drag?.type === "pan") {
        setCameraLive((cam) => ({
          ...cam,
          x: cam.x + (mid.x - drag.last.x),
          y: cam.y + (mid.y - drag.last.y),
        }));
        dragRef.current = { type: "pan", last: mid };
        requestRedraw();
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const world = screenToWorld(screen, cameraRef.current);

    if (drag.type === "pan") {
      const dx = screen.x - drag.last.x;
      const dy = screen.y - drag.last.y;
      const cam = cameraRef.current;
      cameraRef.current = { ...cam, x: cam.x + dx, y: cam.y + dy };
      cameraDirtyRef.current = true;
      drag.last = screen;
      requestRedraw();
      return;
    }

    if (drag.type === "marquee") {
      dragRef.current = { ...drag, current: world };
      requestRedraw();
      return;
    }

    if (drag.type === "move") {
      const dx = world.x - drag.last.x;
      const dy = world.y - drag.last.y;
      const idSet = drag.ids.length > 1 ? new Set(drag.ids) : null;
      for (const obj of objectsRef.current) {
        if (idSet ? idSet.has(obj.id) : obj.id === drag.ids[0]) moveObjInPlace(obj, dx, dy);
      }
      drag.last = world;
      requestRedraw();
      return;
    }

    if (drag.type === "resize") {
      const next = resizeObj(drag.orig, drag.corner, world, cameraRef.current.zoom);
      objectsRef.current = objectsRef.current.map((obj) => (obj.id === drag.id ? next : obj));
      requestRedraw();
      return;
    }

    if (drag.type === "draw-shape") {
      const idx = objectsRef.current.findIndex((obj) => obj.id === drag.id);
      if (idx >= 0) {
        const obj = objectsRef.current[idx];
        if (obj.kind === "shape") {
          objectsRef.current[idx] = { ...obj, w: world.x - obj.x, h: world.y - obj.y };
        }
      }
      requestRedraw();
      return;
    }

    if (drag.type === "draw-connector") {
      const idx = objectsRef.current.findIndex((obj) => obj.id === drag.id);
      if (idx >= 0) {
        const obj = objectsRef.current[idx];
        if (obj.kind === "connector") {
          objectsRef.current[idx] = { ...obj, x2: world.x, y2: world.y };
        }
      }
      requestRedraw();
      return;
    }

    if (drag.type === "draw-stroke") {
      const live = strokeLiveRef.current;
      if (live && live.id === drag.id) {
        const pts = live.points;
        const last = pts[pts.length - 1];
        // Skip near-duplicate points to keep stroke arrays smaller
        if (!last || dist(last, world) >= 1.25 / cameraRef.current.zoom) {
          pts.push(world);
          requestRedraw();
        }
      }
      return;
    }

    if (drag.type === "erase") eraseAt(world);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (event.button === 2) rightPanRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor =
        toolRef.current === "hand" || spaceDown.current ? "grab" : "default";
    }

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.type === "marquee") {
      const x1 = Math.min(drag.start.x, drag.current.x);
      const y1 = Math.min(drag.start.y, drag.current.y);
      const x2 = Math.max(drag.start.x, drag.current.x);
      const y2 = Math.max(drag.start.y, drag.current.y);
      const ids = objectsRef.current
        .filter((obj) => {
          const b = boundsOf(obj, cameraRef.current.zoom);
          if (!b) return false;
          return b.x < x2 && b.x + b.w > x1 && b.y < y2 && b.y + b.h > y1;
        })
        .map((obj) => obj.id);
      setSelection(ids);
    }

    if (
      drag.type === "draw-shape" ||
      drag.type === "draw-connector" ||
      drag.type === "draw-stroke" ||
      drag.type === "move" ||
      drag.type === "resize" ||
      drag.type === "pan" ||
      drag.type === "erase"
    ) {
      // Normalize negative shape sizes
      if (drag.type === "draw-shape") {
        objectsRef.current = objectsRef.current.map((obj) => {
          if (obj.id !== drag.id || obj.kind !== "shape") return obj;
          const x = obj.w < 0 ? obj.x + obj.w : obj.x;
          const y = obj.h < 0 ? obj.y + obj.h : obj.y;
          return { ...obj, x, y, w: Math.abs(obj.w) || 1, h: Math.abs(obj.h) || 1 };
        });
      }
      strokeLiveRef.current = null;
      setObjects(objectsRef.current.slice());
      flushCamera();
      if (drag.type !== "pan") scheduleSave();
    }

    canvasRectRef.current = null;
    dragRef.current = null;
  };

  // FigJam-style: scroll wheel zooms toward cursor (no modifier). Use native
  // listener so preventDefault works (React wheel is often passive).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let wheelFlushTimer: number | null = null;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvasRectRef.current ?? canvas.getBoundingClientRect();
      canvasRectRef.current = rect;
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      // Prefer vertical delta; trackpad pinch often comes as ctrl+wheel — still zoom.
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      const factor = delta < 0 ? 1.08 : 1 / 1.08;
      zoomAt(screen, cameraRef.current.zoom * factor);
      if (wheelFlushTimer) window.clearTimeout(wheelFlushTimer);
      wheelFlushTimer = window.setTimeout(() => {
        wheelFlushTimer = null;
        canvasRectRef.current = null;
        flushCamera();
      }, 150);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      if (wheelFlushTimer) window.clearTimeout(wheelFlushTimer);
    };
  }, [flushCamera, zoomAt]);

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current !== "select") return;
    const world = screenToWorld(screenPoint(event), cameraRef.current);
    const hit = hitTest(objectsRef.current, world, cameraRef.current.zoom);
    const obj = objectsRef.current.find((o) => o.id === hit);
    if (obj?.kind === "text") {
      setSelection([obj.id]);
      setTextDraft({
        id: obj.id,
        x: obj.x,
        y: obj.y - obj.fontSize,
        value: obj.text,
        kind: "text",
        editing: true,
      });
    } else if (obj?.kind === "sticky") {
      setSelection([obj.id]);
      setTextDraft({
        id: obj.id,
        x: obj.x,
        y: obj.y,
        value: obj.text,
        kind: "sticky",
        editing: true,
      });
    } else if (obj?.kind === "pdf" || obj?.kind === "video") {
      setSelection([obj.id]);
    }
  };

  const commitText = () => {
    if (!textDraft) return;
    const value = textDraft.value.trimEnd();
    if (textDraft.kind === "sticky" && textDraft.id) {
      commitObjects(
        (prev) =>
          prev.map((obj) =>
            obj.id === textDraft.id && obj.kind === "sticky" ? { ...obj, text: value } : obj,
          ),
        true,
      );
      setTextDraft(null);
      return;
    }
    if (!value) {
      if (textDraft.editing && textDraft.id) {
        commitObjects((prev) => prev.filter((o) => o.id !== textDraft.id), true);
      }
      setTextDraft(null);
      return;
    }
    if (textDraft.editing && textDraft.id) {
      commitObjects(
        (prev) =>
          prev.map((obj) =>
            obj.id === textDraft.id && obj.kind === "text"
              ? { ...obj, text: value, color: colorRef.current }
              : obj,
          ),
        true,
      );
    } else {
      const item: TextObj = {
        id: uid(),
        kind: "text",
        x: textDraft.x,
        y: textDraft.y,
        text: value,
        color: colorRef.current,
        fontSize: Math.max(16, strokeWidthRef.current * 5),
      };
      commitObjects((prev) => [...prev, item], true);
      setSelection([item.id]);
    }
    setTextDraft(null);
  };

  const canvasCenterWorld = useCallback((): Point => {
    const cam = cameraRef.current;
    const wrap = wrapRef.current;
    return screenToWorld(
      { x: (wrap?.clientWidth || 800) / 2, y: (wrap?.clientHeight || 600) / 2 },
      cam,
    );
  }, []);

  const placeResourceDone = useCallback(() => {
    setResourcesOpen(false);
    setResourceError(null);
    setYoutubeUrl("");
    setToolBoth("select");
  }, []);

  const importImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || "");
        if (!src) return;
        const img = new Image();
        img.onload = () => {
          const center = canvasCenterWorld();
          const maxW = 320;
          const scale = Math.min(1, maxW / Math.max(img.width, 1));
          const item: ImageObj = {
            id: uid(),
            kind: "image",
            x: center.x - (img.width * scale) / 2,
            y: center.y - (img.height * scale) / 2,
            w: img.width * scale,
            h: img.height * scale,
            src,
          };
          imageCache.current.set(item.id, img);
          commitObjects((prev) => [...prev, item], true);
          setSelection([item.id]);
          placeResourceDone();
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    },
    [canvasCenterWorld, commitObjects, placeResourceDone, setSelection],
  );

  const importVideoFile = useCallback(
    (file: File) => {
      if (file.size > 6 * 1024 * 1024) {
        setResourceError("Video uploads work best under 6MB. Use a YouTube link for larger videos.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || "");
        if (!src) return;
        const center = canvasCenterWorld();
        const item: VideoObj = {
          id: uid(),
          kind: "video",
          x: center.x - 240,
          y: center.y - 135,
          w: 480,
          h: 270,
          source: "upload",
          src,
          title: file.name.replace(/\.[^.]+$/, "") || "Video",
        };
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = src;
        video.onloadeddata = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumb = new Image();
              thumb.onload = () => {
                imageCache.current.set(item.id, thumb);
                requestRedraw();
              };
              thumb.src = canvas.toDataURL("image/jpeg", 0.7);
            }
          } catch {
            /* thumbnail optional */
          }
        };
        commitObjects((prev) => [...prev, item], true);
        setSelection([item.id]);
        placeResourceDone();
      };
      reader.readAsDataURL(file);
    },
    [canvasCenterWorld, commitObjects, placeResourceDone, requestRedraw, setSelection],
  );

  const importPdfFile = useCallback(
    (file: File) => {
      if (file.size > 6 * 1024 * 1024) {
        setResourceError("PDF uploads work best under 6MB for board storage.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || "");
        if (!src) return;
        const center = canvasCenterWorld();
        const item: PdfObj = {
          id: uid(),
          kind: "pdf",
          x: center.x - 210,
          y: center.y - 270,
          w: 420,
          h: 540,
          src,
          title: file.name || "Document.pdf",
        };
        commitObjects((prev) => [...prev, item], true);
        setSelection([item.id]);
        placeResourceDone();
      };
      reader.readAsDataURL(file);
    },
    [canvasCenterWorld, commitObjects, placeResourceDone, setSelection],
  );

  const placeYouTubeVideo = useCallback(() => {
    const id = parseYouTubeId(youtubeUrl);
    if (!id) {
      setResourceError("Enter a valid YouTube URL or video ID.");
      return;
    }
    const center = canvasCenterWorld();
    const item: VideoObj = {
      id: uid(),
      kind: "video",
      x: center.x - 240,
      y: center.y - 135,
      w: 480,
      h: 270,
      source: "youtube",
      src: `https://www.youtube.com/watch?v=${id}`,
      youtubeId: id,
      title: "YouTube video",
    };
    const thumb = new Image();
    thumb.onload = () => {
      imageCache.current.set(item.id, thumb);
      requestRedraw();
    };
    thumb.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    commitObjects((prev) => [...prev, item], true);
    setSelection([item.id]);
    placeResourceDone();
  }, [canvasCenterWorld, commitObjects, placeResourceDone, requestRedraw, setSelection, youtubeUrl]);

  const importFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) importImageFile(file);
        else if (file.type.startsWith("video/")) importVideoFile(file);
        else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) importPdfFile(file);
      });
    },
    [importImageFile, importPdfFile, importVideoFile],
  );

  const placedTradeIds = useMemo(
    () => new Set(objects.filter((obj): obj is TradeObj => obj.kind === "trade").map((obj) => obj.tradeId)),
    [objects],
  );

  const journalTrades = useMemo(() => {
    const needle = tradeQuery.trim().toLowerCase();
    const source = trades.some((trade) => !isUnjournaledTrade(trade) || trade.checklistId)
      ? trades.filter((trade) => !isUnjournaledTrade(trade) || trade.checklistId)
      : trades;
    return [...source]
      .filter((trade) => !placedTradeIds.has(trade.id))
      .sort((a, b) => (b.openTime || b.date).localeCompare(a.openTime || a.date))
      .filter((trade) => {
        if (!needle) return true;
        const playbook = trade.checklistId
          ? playbooks.find((item) => item.id === trade.checklistId)?.name || ""
          : "";
        return `${trade.pair} ${trade.direction} ${trade.date} ${trade.notes || ""} ${playbook}`
          .toLowerCase()
          .includes(needle);
      })
      .slice(0, 80);
  }, [placedTradeIds, playbooks, tradeQuery, trades]);

  const placeJournalTrade = useCallback(
    (trade: Trade) => {
      if (placedTradeIds.has(trade.id)) return;
      const center = canvasCenterWorld();
      const item: TradeObj = {
        id: uid(),
        kind: "trade",
        tradeId: trade.id,
        x: center.x - (TRADE_CARD_SCREEN_W / cameraRef.current.zoom) / 2,
        y: center.y - (TRADE_CARD_SCREEN_H / cameraRef.current.zoom) / 2,
        w: TRADE_CARD_SCREEN_W,
        h: TRADE_CARD_SCREEN_H,
      };
      commitObjects((prev) => [...prev, item], true);
      setSelection([item.id]);
      setTradesOpen(false);
      setTradeQuery("");
      setToolBoth("select");
    },
    [canvasCenterWorld, commitObjects, placedTradeIds, setSelection],
  );

  const placedNoteKeys = useMemo(
    () =>
      new Set(
        objects
          .filter((obj): obj is NoteObj => obj.kind === "note")
          .map((obj) => `${obj.source}:${obj.noteId}`),
      ),
    [objects],
  );

  const boardNoteOptions = useMemo(() => {
    const needle = noteQuery.trim().toLowerCase();
    const study = studyNotes.map((note) => {
      const preview = studyDocPlainText(note.content);
      return {
        key: `study:${note.id}`,
        source: "study" as const,
        noteId: note.id,
        title: note.title || "Untitled note",
        preview,
        meta: note.updated_at ? new Date(note.updated_at).toLocaleString() : "Study note",
        search: `${note.title} ${preview}`.toLowerCase(),
      };
    });
    const notebook = notebookEntries
      .filter((entry) => !entry.isDeleted)
      .map((entry) => {
        const preview = notebookPlainText(entry.content || "");
        return {
          key: `notebook:${entry.id}`,
          source: "notebook" as const,
          noteId: entry.id,
          title: entry.title || "Untitled entry",
          preview,
          meta: `${entry.category || "Notebook"} · ${entry.date || entry.updatedAt || ""}`,
          search: `${entry.title} ${entry.category} ${preview}`.toLowerCase(),
        };
      });
    return [...study, ...notebook]
      .filter((item) => !placedNoteKeys.has(item.key))
      .filter((item) => (noteSourceFilter === "all" ? true : item.source === noteSourceFilter))
      .filter((item) => (!needle ? true : item.search.includes(needle)))
      .slice(0, 100);
  }, [noteQuery, noteSourceFilter, notebookEntries, placedNoteKeys, studyNotes]);

  const placeBoardNote = useCallback(
    (source: "study" | "notebook", noteId: string) => {
      const key = `${source}:${noteId}`;
      if (placedNoteKeys.has(key)) return;
      const center = canvasCenterWorld();
      const item: NoteObj = {
        id: uid(),
        kind: "note",
        source,
        noteId,
        x: center.x - (NOTE_CARD_SCREEN_W / cameraRef.current.zoom) / 2,
        y: center.y - (NOTE_CARD_SCREEN_H / cameraRef.current.zoom) / 2,
        w: NOTE_CARD_SCREEN_W,
        h: NOTE_CARD_SCREEN_H,
      };
      commitObjects((prev) => [...prev, item], true);
      setSelection([item.id]);
      setNotesOpen(false);
      setNoteQuery("");
      setToolBoth("select");
    },
    [canvasCenterWorld, commitObjects, placedNoteKeys, setSelection],
  );

  const draftScreen = textDraft
    ? worldToScreen({ x: textDraft.x, y: textDraft.y }, camera)
    : null;

  const draftStyle: CSSProperties | undefined =
    textDraft && draftScreen
      ? {
          left: draftScreen.x,
          top: draftScreen.y,
          color: textDraft.kind === "sticky" ? "#1f2937" : color,
          fontSize: textDraft.kind === "sticky" ? 14 : Math.max(16, strokeWidth * 5),
          width: textDraft.kind === "sticky" ? 180 * camera.zoom : undefined,
          height: textDraft.kind === "sticky" ? 160 * camera.zoom : undefined,
          background: textDraft.kind === "sticky" ? stickyColor : "hsl(var(--background) / 0.95)",
          transform: `scale(${textDraft.kind === "sticky" ? 1 : 1})`,
        }
      : undefined;

  const bindMediaDrag = (mediaId: string) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (toolRef.current === "hand" || spaceDown.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvasRectRef.current = canvas.getBoundingClientRect();
      const rect = canvasRectRef.current;
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const world = screenToWorld(screen, cameraRef.current);
      setSelection([mediaId]);
      pushHistory();
      dragRef.current = { type: "move", ids: [mediaId], last: world };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.type !== "move" || !drag.ids.includes(mediaId)) return;
      const rect = canvasRectRef.current ?? canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const world = screenToWorld(screen, cameraRef.current);
      const dx = world.x - drag.last.x;
      const dy = world.y - drag.last.y;
      for (const obj of objectsRef.current) {
        if (obj.id === mediaId) moveObjInPlace(obj, dx, dy);
      }
      drag.last = world;
      requestRedraw();
    },
    onPointerUp: () => {
      if (dragRef.current?.type === "move") {
        setObjects(objectsRef.current.slice());
        scheduleSave();
      }
      dragRef.current = null;
      canvasRectRef.current = null;
    },
    onPointerCancel: () => {
      dragRef.current = null;
      canvasRectRef.current = null;
    },
  });

  const bindTradeResize = (mediaId: string, corner: Corner) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (toolRef.current === "hand" || spaceDown.current) return;
      const canvas = canvasRef.current;
      const orig = objectsRef.current.find((obj) => obj.id === mediaId);
      if (!canvas || !orig || (orig.kind !== "trade" && orig.kind !== "note")) return;
      canvasRectRef.current = canvas.getBoundingClientRect();
      const rect = canvasRectRef.current;
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const world = screenToWorld(screen, cameraRef.current);
      setSelection([mediaId]);
      pushHistory();
      dragRef.current = { type: "resize", id: mediaId, corner, start: world, orig: structuredClone(orig) };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag?.type !== "resize" || drag.id !== mediaId) return;
      const rect = canvasRectRef.current ?? canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const world = screenToWorld(screen, cameraRef.current);
      const next = resizeObj(drag.orig, drag.corner, world, cameraRef.current.zoom);
      objectsRef.current = objectsRef.current.map((obj) => (obj.id === mediaId ? next : obj));
      requestRedraw();
    },
    onPointerUp: () => {
      if (dragRef.current?.type === "resize") {
        setObjects(objectsRef.current.slice());
        scheduleSave();
      }
      dragRef.current = null;
      canvasRectRef.current = null;
    },
    onPointerCancel: () => {
      dragRef.current = null;
      canvasRectRef.current = null;
    },
  });

  const renderMediaShell = (
    media: VideoObj | PdfObj,
    body: ReactNode,
    tone: "dark" | "light",
  ) => {
    const selected = selectedIds.includes(media.id);
    const hovered = hoveredMediaId === media.id;
    return (
      <div
        key={media.id}
        data-media-id={media.id}
        className={cn(
          "pointer-events-auto absolute left-0 top-0 overflow-visible rounded-md shadow-md will-change-transform",
          tone === "dark" ? "bg-black" : "bg-card",
          selected || hovered ? "ring-2 ring-primary" : "ring-1 ring-border/60",
        )}
        style={{ width: 1, height: 1 }}
        onMouseEnter={() => setHoveredMediaId(media.id)}
        onMouseLeave={() => setHoveredMediaId((id) => (id === media.id ? null : id))}
      >
        <div
          className="absolute inset-x-0 top-0 z-20 flex h-7 -translate-y-full cursor-grab items-center justify-center gap-1 rounded-t-md bg-card/95 text-[10px] font-medium text-muted-foreground shadow-sm active:cursor-grabbing"
          {...bindMediaDrag(media.id)}
        >
          <GripVertical className="h-3 w-3 opacity-70" />
          <span className="max-w-[85%] truncate">{media.title || (media.kind === "pdf" ? "PDF" : "Video")}</span>
        </div>
        <div className="h-full w-full overflow-hidden rounded-md bg-background">{body}</div>
      </div>
    );
  };

  const bottomRightControls = (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card/90 p-1 shadow-sm backdrop-blur">
      <button
        type="button"
        aria-label="Undo"
        title="Undo"
        onClick={undo}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo"
        onClick={redo}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Delete selected"
        title={selectedIds.length ? `Delete selected (${selectedIds.length})` : "Select items to delete"}
        disabled={!selectedIds.length}
        onClick={deleteSelected}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full",
          selectedIds.length
            ? "text-destructive hover:bg-destructive/10"
            : "cursor-not-allowed text-muted-foreground/40",
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Clear entire board"
        title="Clear entire board"
        disabled={!objects.length}
        onClick={clearBoard}
        className={cn(
          "rounded-full px-2 text-[11px] font-semibold",
          objects.length
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "cursor-not-allowed text-muted-foreground/40",
        )}
      >
        Clear
      </button>

      <div className="mx-0.5 h-4 w-px shrink-0 bg-border/60" aria-hidden />

      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => {
          const wrap = wrapRef.current;
          if (!wrap) return;
          zoomAt({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }, cameraRef.current.zoom / 1.15);
          flushCamera();
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Reset zoom"
        onClick={() => {
          const wrap = wrapRef.current;
          if (!wrap) return;
          zoomAt({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }, 1);
          flushCamera();
        }}
        className="min-w-[3.25rem] rounded-full px-2 text-xs font-medium tabular-nums text-foreground hover:bg-muted"
      >
        <span ref={zoomLabelRef}>{Math.round(camera.zoom * 100)}%</span>
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => {
          const wrap = wrapRef.current;
          if (!wrap) return;
          zoomAt({ x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 }, cameraRef.current.zoom * 1.15);
          flushCamera();
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Fit to content"
        onClick={fitToContent}
        className="rounded-full px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Fit
      </button>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border/40 bg-background">
      {/* Slim floating top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 p-2 sm:p-3">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card/90 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur hover:bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Boards</span>
        </button>
        {editingBoardName ? (
          <input
            ref={boardNameInputRef}
            value={boardNameDraft}
            onChange={(event) => setBoardNameDraft(event.target.value)}
            onBlur={commitBoardName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitBoardName();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setBoardNameDraft(boardName);
                setEditingBoardName(false);
              }
            }}
            aria-label="Board name"
            className="pointer-events-auto max-w-[40%] truncate rounded-full border border-primary/40 bg-card px-3 py-1.5 text-center text-sm font-semibold text-foreground shadow-sm outline-none backdrop-blur"
          />
        ) : (
          <button
            type="button"
            title="Rename board"
            onClick={() => {
              if (!onRenameBoard) return;
              setBoardNameDraft(boardName);
              setEditingBoardName(true);
            }}
            className="pointer-events-auto max-w-[40%] truncate rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur hover:border-border hover:bg-card"
          >
            {boardName}
          </button>
        )}
        <div className="pointer-events-none w-[7.5rem] sm:w-[9rem]" aria-hidden />
      </div>

      {tool === "sticky" ||
      textDraft?.kind === "sticky" ||
      selectedIds.some((id) => objects.find((o) => o.id === id)?.kind === "sticky") ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-3 sm:top-16">
          <div className="pointer-events-auto inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur">
            <span className="text-xs font-medium text-muted-foreground">Sticky color</span>
            <div className="flex items-center gap-1.5">
              {STICKY_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Sticky ${c}`}
                  aria-pressed={stickyColor.toLowerCase() === c.toLowerCase()}
                  onClick={() => applyStickyColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border transition-transform hover:scale-110",
                    stickyColor.toLowerCase() === c.toLowerCase()
                      ? "border-foreground ring-2 ring-foreground/25"
                      : "border-border/70",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="mx-0.5 hidden h-5 w-px bg-border/60 sm:block" aria-hidden />
            <label
              ref={stickySwatchRef}
              className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border/70 shadow-sm"
              style={{ background: stickyColor }}
              title="Custom color"
            >
              <span className="sr-only">Custom sticky color</span>
              <input
                ref={stickyColorInputRef}
                type="color"
                defaultValue={stickyColor}
                onInput={(event) => previewStickyColor((event.target as HTMLInputElement).value)}
                onChange={(event) => previewStickyColor(event.target.value)}
                onBlur={endStickyColorPick}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <input
              ref={stickyHexRef}
              type="text"
              defaultValue={stickyColor}
              spellCheck={false}
              aria-label="Sticky color hex"
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(raw)) applyStickyColor(raw);
              }}
              onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!/^#[0-9a-fA-F]{6}$/.test(raw)) {
                  event.target.value = stickyColorRef.current;
                }
              }}
              className="h-7 w-[5.25rem] rounded-full border border-border/50 bg-background/80 px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>
      ) : null}

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files?.length) importFiles(event.dataTransfer.files);
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{
            touchAction: "none",
            cursor: tool === "hand" || spaceDown.current || rightPanRef.current ? "grab" : "default",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={(event) => {
            rightPanRef.current = false;
            onPointerUp(event);
          }}
          onDoubleClick={onDoubleClick}
          onContextMenu={(event) => event.preventDefault()}
        />

        {textDraft && draftStyle ? (
          <textarea
            ref={textRef}
            value={textDraft.value}
            onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })}
            onBlur={commitText}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && textDraft.kind === "text") {
                event.preventDefault();
                commitText();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setTextDraft(null);
              }
            }}
            className="absolute z-10 resize-none rounded-md border border-primary/40 px-2 py-1 font-sans shadow-sm outline-none"
            style={draftStyle}
            placeholder={textDraft.kind === "sticky" ? "Sticky note…" : "Type…"}
          />
        ) : null}

        {/* Persistent media overlays — video + PDF preview in place on the canvas */}
        <div ref={mediaLayerRef} className="pointer-events-none absolute inset-0 z-[15] overflow-visible">
          {objects
            .filter((obj): obj is VideoObj => obj.kind === "video")
            .map((media) =>
              renderMediaShell(
                media,
                media.source === "youtube" && media.youtubeId ? (
                  <iframe
                    title={media.title}
                    src={`https://www.youtube.com/embed/${media.youtubeId}?rel=0`}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video src={media.src} controls playsInline className="h-full w-full bg-black" />
                ),
                "dark",
              ),
            )}
          {objects
            .filter((obj): obj is PdfObj => obj.kind === "pdf")
            .map((media) =>
              renderMediaShell(
                media,
                <iframe
                  title={media.title}
                  src={`${media.src}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  className="h-full w-full border-0 bg-white"
                />,
                "light",
              ),
            )}
          {objects
            .filter((obj): obj is TradeObj => obj.kind === "trade")
            .map((media) => {
              const trade = trades.find((item) => item.id === media.tradeId);
              const selected = selectedIds.includes(media.id);
              const hovered = hoveredMediaId === media.id;
              const pnl = trade ? getTradeNetResult(trade) : 0;
              const when = trade ? formatStudyTradeWhen(trade) : null;
              const playbook = trade?.checklistId
                ? playbooks.find((item) => item.id === trade.checklistId)?.name || "Playbook removed"
                : null;
              const formatPrice = (value: number) => value.toFixed(value > 100 ? 2 : 5);
              return (
                <div
                  key={media.id}
                  data-media-id={media.id}
                  className={cn(
                    "pointer-events-auto absolute left-0 top-0 overflow-visible rounded-xl bg-card shadow-md will-change-transform",
                    selected || hovered ? "ring-2 ring-primary" : "ring-1 ring-border/60",
                  )}
                  style={{ width: 1, height: 1 }}
                  onMouseEnter={() => setHoveredMediaId(media.id)}
                  onMouseLeave={() => setHoveredMediaId((id) => (id === media.id ? null : id))}
                >
                  <div
                    className="absolute inset-x-0 top-0 z-20 flex h-7 -translate-y-full cursor-grab items-center justify-center gap-1 rounded-t-md bg-card/95 text-[10px] font-medium text-muted-foreground shadow-sm active:cursor-grabbing"
                    {...bindMediaDrag(media.id)}
                  >
                    <GripVertical className="h-3 w-3 opacity-70" />
                    <span className="max-w-[85%] truncate">{trade?.pair || "Trade"}</span>
                  </div>
                  {selected
                    ? (
                      [
                        { corner: "nw" as const, className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
                        { corner: "ne" as const, className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
                        { corner: "sw" as const, className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
                        { corner: "se" as const, className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
                      ] as const
                    ).map(({ corner, className }) => (
                      <div
                        key={corner}
                        className={cn("absolute z-30 h-3 w-3 rounded-sm bg-primary shadow", className)}
                        {...bindTradeResize(media.id, corner)}
                      />
                    ))
                  : null}
                  <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card/95">
                    {trade ? (
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5">
                        <div className="flex items-start gap-2.5">
                          <AssetIcon symbol={trade.pair} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{trade.pair}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                      trade.direction === "Long"
                                        ? "bg-primary/15 text-primary"
                                        : "bg-destructive/15 text-destructive",
                                    )}
                                  >
                                    {trade.direction}
                                  </span>
                                  {trade.session ? (
                                    <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      {trade.session}
                                    </span>
                                  ) : null}
                                  {trade.executionType ? (
                                    <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      {trade.executionType}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 font-mono text-sm font-bold tabular-nums",
                                  pnl >= 0 ? "text-primary" : "text-destructive",
                                )}
                              >
                                {formatPnL(pnl)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">When</p>
                            <p className="font-medium text-foreground">
                              {when ? `${when.date}${when.time ? ` · ${when.time}` : ""}` : trade.date}
                            </p>
                          </div>
                          {playbook ? (
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Playbook</p>
                              <p className="truncate font-medium text-foreground">{playbook}</p>
                            </div>
                          ) : null}
                          {trade.openPrice != null ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Open</p>
                              <p className="font-mono font-medium text-foreground">{formatPrice(trade.openPrice)}</p>
                            </div>
                          ) : null}
                          {trade.closePrice != null ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Close</p>
                              <p className="font-mono font-medium text-foreground">{formatPrice(trade.closePrice)}</p>
                            </div>
                          ) : null}
                          {trade.commission != null && trade.commission !== 0 ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Commission</p>
                              <p className="font-mono font-medium text-foreground">{trade.commission.toFixed(2)}</p>
                            </div>
                          ) : null}
                          {trade.swap != null && trade.swap !== 0 ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Swap</p>
                              <p className="font-mono font-medium text-foreground">{trade.swap.toFixed(2)}</p>
                            </div>
                          ) : null}
                          {trade.brokerName ? (
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Broker</p>
                              <p className="truncate font-medium text-foreground">{trade.brokerName}</p>
                            </div>
                          ) : null}
                          {trade.result !== pnl ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gross</p>
                              <p className="font-mono font-medium text-foreground">{formatPnL(trade.result)}</p>
                            </div>
                          ) : null}
                        </div>

                        {trade.notes?.trim() ? (
                          <div>
                            <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                            <p className="whitespace-pre-wrap text-[11px] leading-snug text-foreground/90">{trade.notes.trim()}</p>
                          </div>
                        ) : null}

                        {onOpenJournal ? (
                          <button
                            type="button"
                            onClick={() => onOpenJournal(trade.id)}
                            className="mt-auto self-start text-[11px] font-medium text-primary hover:underline"
                          >
                            Open in journal
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="px-3 py-2.5 text-sm text-muted-foreground">Trade removed</p>
                    )}
                  </div>
                </div>
              );
            })}
          {objects
            .filter((obj): obj is NoteObj => obj.kind === "note")
            .map((media) => {
              const studyNote =
                media.source === "study" ? studyNotes.find((note) => note.id === media.noteId) : undefined;
              const notebookNote =
                media.source === "notebook"
                  ? notebookEntries.find((entry) => entry.id === media.noteId && !entry.isDeleted)
                  : undefined;
              const title =
                studyNote?.title ||
                notebookNote?.title ||
                (media.source === "study" ? "Study note" : "Notebook entry");
              const preview = studyNote
                ? studyDocPlainText(studyNote.content)
                : notebookNote
                  ? notebookPlainText(notebookNote.content || "")
                  : "";
              const meta = studyNote
                ? studyNote.updated_at
                  ? new Date(studyNote.updated_at).toLocaleString()
                  : "Study note"
                : notebookNote
                  ? `${notebookNote.category || "Notebook"}${notebookNote.date ? ` · ${notebookNote.date}` : ""}`
                  : null;
              const selected = selectedIds.includes(media.id);
              const hovered = hoveredMediaId === media.id;
              const missing = media.source === "study" ? !studyNote : !notebookNote;
              return (
                <div
                  key={media.id}
                  data-media-id={media.id}
                  className={cn(
                    "pointer-events-auto absolute left-0 top-0 overflow-visible rounded-xl bg-card shadow-md will-change-transform",
                    selected || hovered ? "ring-2 ring-primary" : "ring-1 ring-border/60",
                  )}
                  style={{ width: 1, height: 1 }}
                  onMouseEnter={() => setHoveredMediaId(media.id)}
                  onMouseLeave={() => setHoveredMediaId((id) => (id === media.id ? null : id))}
                >
                  <div
                    className="absolute inset-x-0 top-0 z-20 flex h-7 -translate-y-full cursor-grab items-center justify-center gap-1 rounded-t-md bg-card/95 text-[10px] font-medium text-muted-foreground shadow-sm active:cursor-grabbing"
                    {...bindMediaDrag(media.id)}
                  >
                    <GripVertical className="h-3 w-3 opacity-70" />
                    <span className="max-w-[85%] truncate">{title}</span>
                  </div>
                  {selected
                    ? (
                      [
                        { corner: "nw" as const, className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
                        { corner: "ne" as const, className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
                        { corner: "sw" as const, className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
                        { corner: "se" as const, className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
                      ] as const
                    ).map(({ corner, className }) => (
                      <div
                        key={corner}
                        className={cn("absolute z-30 h-3 w-3 rounded-sm bg-primary shadow", className)}
                        {...bindTradeResize(media.id, corner)}
                      />
                    ))
                  : null}
                  <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card/95">
                    {missing ? (
                      <p className="px-3 py-2.5 text-sm text-muted-foreground">Note removed</p>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-foreground">
                            <NotebookPen className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                  media.source === "study"
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {media.source === "study" ? "Study" : "Notebook"}
                              </span>
                              {meta ? <span className="text-[10px] text-muted-foreground">{meta}</span> : null}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-foreground">{title}</p>
                          </div>
                        </div>
                        <p className="line-clamp-5 text-[11px] leading-relaxed text-muted-foreground">
                          {preview || "No preview available."}
                        </p>
                        {media.source === "study" && onOpenStudyNote ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenStudyNote(media.noteId);
                            }}
                            className="mt-auto self-start text-[11px] font-medium text-primary hover:underline"
                          >
                            Open study note
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Shapes picker — rendered inside the board overlay so it isn't buried under z-index */}
        {shapesOpen ? (
          <div
            className="pointer-events-auto absolute z-30 w-[min(22rem,calc(100vw-5rem))] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur"
            style={
              toolPanelPos
                ? { left: toolPanelPos.left + 76, top: Math.max(12, toolPanelPos.top) }
                : { left: 76, top: "50%", transform: "translateY(-50%)" }
            }
            role="dialog"
            aria-label="Shapes"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Shapes</p>
                <p className="text-xs text-muted-foreground">Search and pick a shape to draw</p>
              </div>
              <button
                type="button"
                aria-label="Close shapes"
                onClick={() => setShapesOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={shapeQuery}
                onChange={(event) => setShapeQuery(event.target.value)}
                placeholder="Search shapes…"
                className="h-9 w-full rounded-xl border border-border/50 bg-muted/40 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40"
              />
            </label>
            <div className="max-h-[min(24rem,55vh)] space-y-3 overflow-y-auto pr-1">
              {(() => {
                const needle = shapeQuery.trim().toLowerCase();
                const filtered = SHAPE_CATALOG.filter((item) => {
                  if (!needle) return true;
                  return `${item.label} ${item.keywords} ${item.category}`.toLowerCase().includes(needle);
                });
                const categories = [...new Set(filtered.map((item) => item.category))];
                if (!filtered.length) {
                  return <p className="px-1 py-6 text-center text-sm text-muted-foreground">No shapes match.</p>;
                }
                return categories.map((category) => (
                  <div key={category}>
                    <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {filtered
                        .filter((item) => item.category === category)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            title={item.label}
                            onClick={() => {
                              shapeKindRef.current = item.id;
                              setShapeKind(item.id);
                              setToolBoth("shape");
                              setShapesOpen(false);
                              setShapeQuery("");
                            }}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-background/50 px-1.5 py-2 text-center transition-colors hover:border-primary/40 hover:bg-primary/10",
                              tool === "shape" && shapeKind === item.id && "border-primary/50 bg-primary/15",
                            )}
                          >
                            <ShapePreview shape={item.id} />
                            <span className="line-clamp-2 text-[10px] font-medium leading-tight text-foreground">
                              {item.label}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        ) : null}

        {/* Resources picker */}
        {resourcesOpen ? (
          <div
            className="pointer-events-auto absolute z-30 w-[min(22rem,calc(100vw-5rem))] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur"
            style={
              toolPanelPos
                ? { left: toolPanelPos.left + 76, top: Math.max(12, toolPanelPos.top) }
                : { left: 76, top: "50%", transform: "translateY(-50%)" }
            }
            role="dialog"
            aria-label="Resources"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Resources</p>
                <p className="text-xs text-muted-foreground">Add image, video, or PDF to the board</p>
              </div>
              <button
                type="button"
                aria-label="Close resources"
                onClick={() => {
                  setResourcesOpen(false);
                  setResourceError(null);
                }}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                Close
              </button>
            </div>

            {resourceError ? (
              <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {resourceError}
              </p>
            ) : null}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setResourceError(null);
                  imageFileRef.current?.click();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 text-foreground">
                  <ImagePlus className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">Image</span>
                  <span className="block text-xs text-muted-foreground">Upload a photo or illustration</span>
                </span>
              </button>

              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="mb-2 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 text-foreground">
                    <Film className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">Video</span>
                    <span className="block text-xs text-muted-foreground">Upload a file or paste a YouTube link</span>
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResourceError(null);
                      videoFileRef.current?.click();
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-border/50 bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/60"
                  >
                    Upload video
                  </button>
                  <div className="flex gap-2">
                    <label className="relative min-w-0 flex-1">
                      <Youtube className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={youtubeUrl}
                        onChange={(event) => {
                          setYoutubeUrl(event.target.value);
                          setResourceError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            placeYouTubeVideo();
                          }
                        }}
                        placeholder="YouTube URL or ID"
                        className="h-9 w-full rounded-lg border border-border/50 bg-card pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/40"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={placeYouTubeVideo}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 px-3 text-xs font-semibold text-foreground hover:bg-primary/25"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResourceError(null);
                  pdfFileRef.current?.click();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 text-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">PDF</span>
                  <span className="block text-xs text-muted-foreground">Preview and scroll the PDF on the board</span>
                </span>
              </button>
            </div>

            <input
              ref={imageFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) importImageFile(file);
                event.target.value = "";
              }}
            />
            <input
              ref={videoFileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) importVideoFile(file);
                event.target.value = "";
              }}
            />
            <input
              ref={pdfFileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) importPdfFile(file);
                event.target.value = "";
              }}
            />
          </div>
        ) : null}

        {/* Journaled trades picker */}
        {tradesOpen ? (
          <div
            className="pointer-events-auto absolute z-30 w-[min(22rem,calc(100vw-5rem))] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur"
            style={
              toolPanelPos
                ? { left: toolPanelPos.left + 76, top: Math.max(12, toolPanelPos.top) }
                : { left: 76, top: "50%", transform: "translateY(-50%)" }
            }
            role="dialog"
            aria-label="Journaled trades"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Journaled trades</p>
                <p className="text-xs text-muted-foreground">Add a trade card to the board</p>
              </div>
              <button
                type="button"
                aria-label="Close trades"
                onClick={() => {
                  setTradesOpen(false);
                  setTradeQuery("");
                }}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <input
              value={tradeQuery}
              onChange={(event) => setTradeQuery(event.target.value)}
              placeholder="Search pair, notes, playbook…"
              className="mb-2 h-9 w-full rounded-xl border border-border/50 bg-background/70 px-3 text-sm outline-none focus:border-primary/40"
            />
            <div className="max-h-[min(22rem,50vh)] space-y-1.5 overflow-y-auto pr-1">
              {journalTrades.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {trades.length === 0 ? "No trades available." : "No journaled trades match."}
                </p>
              ) : (
                journalTrades.map((trade) => (
                  <StudyTradeCard
                    key={trade.id}
                    tradeId={trade.id}
                    trades={trades}
                    playbooks={playbooks}
                    onSelect={() => placeJournalTrade(trade)}
                  />
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* Notes picker — study + notebook */}
        {notesOpen ? (
          <div
            className="pointer-events-auto absolute z-30 w-[min(22rem,calc(100vw-5rem))] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur"
            style={
              toolPanelPos
                ? { left: toolPanelPos.left + 76, top: Math.max(12, toolPanelPos.top) }
                : { left: 76, top: "50%", transform: "translateY(-50%)" }
            }
            role="dialog"
            aria-label="Notes"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Notes</p>
                <p className="text-xs text-muted-foreground">Add study or notebook notes to the board</p>
              </div>
              <button
                type="button"
                aria-label="Close notes"
                onClick={() => {
                  setNotesOpen(false);
                  setNoteQuery("");
                }}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="mb-2 flex gap-1 rounded-xl bg-muted/40 p-1">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "study", label: "Study" },
                  { id: "notebook", label: "Notebook" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNoteSourceFilter(tab.id)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                    noteSourceFilter === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              value={noteQuery}
              onChange={(event) => setNoteQuery(event.target.value)}
              placeholder="Search notes…"
              className="mb-2 h-9 w-full rounded-xl border border-border/50 bg-background/70 px-3 text-sm outline-none focus:border-primary/40"
            />
            <div className="max-h-[min(22rem,50vh)] space-y-1.5 overflow-y-auto pr-1">
              {boardNoteOptions.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notes match.</p>
              ) : (
                boardNoteOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => placeBoardNote(item.source, item.noteId)}
                    className="flex w-full flex-col gap-1 rounded-xl border border-transparent bg-background/70 px-3 py-2.5 text-left hover:border-border hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          item.source === "study" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.source === "study" ? "Study" : "Notebook"}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {item.preview || "No preview"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{item.meta}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* Draggable vertical tool rail */}
        <TooltipProvider delayDuration={200}>
          <div
            ref={toolPanelRef}
            className="pointer-events-auto absolute z-20 flex max-h-[calc(100%-4rem)] w-[4.25rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-lg backdrop-blur"
            style={
              toolPanelPos
                ? { left: toolPanelPos.left, top: toolPanelPos.top }
                : { left: 12, top: "50%", transform: "translateY(-50%)" }
            }
          >
            <button
              type="button"
              aria-label="Drag tools panel"
              className="flex h-7 w-full shrink-0 cursor-grab items-center justify-center border-b border-border/50 text-muted-foreground hover:bg-muted/50 active:cursor-grabbing"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const panel = toolPanelRef.current;
                const wrap = wrapRef.current;
                if (!panel || !wrap) return;
                const panelRect = panel.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();
                const left = panelRect.left - wrapRect.left;
                const top = panelRect.top - wrapRect.top;
                toolPanelDragRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  origLeft: left,
                  origTop: top,
                };
                panel.style.left = `${left}px`;
                panel.style.top = `${top}px`;
                panel.style.transform = "none";
                (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const drag = toolPanelDragRef.current;
                const wrap = wrapRef.current;
                const panel = toolPanelRef.current;
                if (!drag || drag.pointerId !== event.pointerId || !wrap || !panel) return;
                const maxLeft = Math.max(8, wrap.clientWidth - panel.offsetWidth - 8);
                const maxTop = Math.max(8, wrap.clientHeight - panel.offsetHeight - 8);
                const left = clamp(drag.origLeft + (event.clientX - drag.startX), 8, maxLeft);
                const top = clamp(drag.origTop + (event.clientY - drag.startY), 8, maxTop);
                panel.style.left = `${left}px`;
                panel.style.top = `${top}px`;
                panel.style.transform = "none";
              }}
              onPointerUp={(event) => {
                const drag = toolPanelDragRef.current;
                const panel = toolPanelRef.current;
                if (!drag || drag.pointerId !== event.pointerId || !panel) return;
                toolPanelDragRef.current = null;
                setToolPanelPos({
                  left: Number.parseFloat(panel.style.left) || drag.origLeft,
                  top: Number.parseFloat(panel.style.top) || drag.origTop,
                });
              }}
              onPointerCancel={() => {
                toolPanelDragRef.current = null;
              }}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>

            <div className="flex min-h-0 flex-1 flex-col items-stretch gap-0.5 overflow-y-auto p-1 scrollbar-hide">
              {TOOLS.filter((t) => t.id === "select" || t.id === "hand" || t.id === "sticky" || t.id === "text").map(
                ({ id, label, shortcut, icon: Icon }) => (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={shortcut ? `${label} (${shortcut})` : label}
                        aria-pressed={tool === id}
                        onClick={() => setToolBoth(id)}
                        className={cn(
                          "flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
                          tool === id
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="w-full truncate text-center text-[9px] font-medium leading-tight">{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10} className="z-[200]">
                      <span className="font-medium">{label}</span>
                      {shortcut ? (
                        <span className="ml-2 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {shortcut}
                        </span>
                      ) : null}
                    </TooltipContent>
                  </Tooltip>
                ),
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Shapes"
                    aria-expanded={shapesOpen}
                    aria-pressed={tool === "shape" || shapesOpen}
                    onClick={() => {
                      setResourcesOpen(false);
                      setTradesOpen(false);
                      setNotesOpen(false);
                      setShapesOpen((open) => !open);
                    }}
                    className={cn(
                      "flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
                      tool === "shape" || shapesOpen
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Shapes className="h-4 w-4 shrink-0" />
                    <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Shapes</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="z-[200]">
                  <span className="font-medium">Shapes</span>
                </TooltipContent>
              </Tooltip>

              {TOOLS.filter((t) => t.id === "connector" || t.id === "pen" || t.id === "marker" || t.id === "eraser").map(
                ({ id, label, shortcut, icon: Icon }) => (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={shortcut ? `${label} (${shortcut})` : label}
                        aria-pressed={tool === id}
                        onClick={() => setToolBoth(id)}
                        className={cn(
                          "flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
                          tool === id
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="w-full truncate text-center text-[9px] font-medium leading-tight">{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10} className="z-[200]">
                      <span className="font-medium">{label}</span>
                      {shortcut ? (
                        <span className="ml-2 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {shortcut}
                        </span>
                      ) : null}
                    </TooltipContent>
                  </Tooltip>
                ),
              )}

              <div className="my-0.5 h-px w-full shrink-0 bg-border/60" />

              <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 p-1">
                <button
                  type="button"
                  aria-label="White board"
                  aria-pressed={background === "white"}
                  onClick={() => applyBackground("white")}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                    background === "white" ? "bg-muted ring-1 ring-foreground/30" : "hover:bg-muted/50",
                  )}
                >
                  <span className="h-3.5 w-3.5 rounded-sm border border-border bg-white" />
                </button>
                <button
                  type="button"
                  aria-label="Black board"
                  aria-pressed={background === "black"}
                  onClick={() => applyBackground("black")}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                    background === "black" ? "bg-muted ring-1 ring-foreground/30" : "hover:bg-muted/50",
                  )}
                >
                  <span className="h-3.5 w-3.5 rounded-sm border border-border bg-black" />
                </button>
                <span className="text-[9px] font-medium text-muted-foreground">Board</span>
              </div>

              <label className="flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-muted-foreground hover:bg-muted/70">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const next = event.target.value;
                    colorRef.current = next;
                    setColor(next);
                    applyStyleToSelection(next, strokeWidthRef.current);
                  }}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Color</span>
              </label>

              <label className="flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 text-muted-foreground" title="Stroke width">
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={strokeWidth}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    strokeWidthRef.current = next;
                    setStrokeWidth(next);
                    applyStyleToSelection(colorRef.current, next);
                  }}
                  className="h-10 w-12 origin-center -rotate-90 accent-[hsl(var(--primary))]"
                />
                <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Width</span>
              </label>

              {tool === "connector" ? (
                <button
                  type="button"
                  title="Toggle arrowhead"
                  onClick={() => {
                    connectorArrow.current = !connectorArrow.current;
                    if (selectedRef.current.size) {
                      commitObjects(
                        (prev) =>
                          prev.map((obj) =>
                            selectedRef.current.has(obj.id) && obj.kind === "connector"
                              ? { ...obj, arrow: connectorArrow.current }
                              : obj,
                          ),
                        true,
                      );
                    }
                  }}
                  className="flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                >
                  <span className="text-sm font-semibold leading-none">→</span>
                  <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Arrow</span>
                </button>
              ) : null}

              <button
                type="button"
                aria-label="Resources"
                aria-expanded={resourcesOpen}
                aria-pressed={resourcesOpen}
                onClick={() => {
                  setShapesOpen(false);
                  setTradesOpen(false);
                  setNotesOpen(false);
                  setResourcesOpen((open) => !open);
                  setResourceError(null);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
                  resourcesOpen
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Resources</span>
              </button>

              <button
                type="button"
                aria-label="Journaled trades"
                aria-expanded={tradesOpen}
                aria-pressed={tradesOpen}
                onClick={() => {
                  setShapesOpen(false);
                  setResourcesOpen(false);
                  setNotesOpen(false);
                  setTradesOpen((open) => !open);
                  setTradeQuery("");
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
                  tradesOpen
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <BookMarked className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Trades</span>
              </button>

              <button
                type="button"
                aria-label="Notes"
                aria-expanded={notesOpen}
                aria-pressed={notesOpen}
                onClick={() => {
                  setShapesOpen(false);
                  setResourcesOpen(false);
                  setTradesOpen(false);
                  setNotesOpen((open) => !open);
                  setNoteQuery("");
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
                  notesOpen
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <NotebookPen className="h-4 w-4 shrink-0" />
                <span className="w-full truncate text-center text-[9px] font-medium leading-tight">Notes</span>
              </button>
            </div>
          </div>
        </TooltipProvider>

        <div className="absolute bottom-3 right-3 z-20">{bottomRightControls}</div>
      </div>
    </div>
  );
}
