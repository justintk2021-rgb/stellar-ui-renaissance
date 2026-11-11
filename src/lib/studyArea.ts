import type { CSSProperties } from "react";
import type { JSONContent } from "@tiptap/core";
import type { Trade } from "@/types/trade";
import { getTradeLocalDateKey, parseLocalDateKey } from "@/lib/tradeFormat";

export type StudyCategory = "individual" | "collaborative" | "case";

export const STUDY_CATEGORIES: { id: StudyCategory; label: string }[] = [
  { id: "individual", label: "Individual" },
  { id: "collaborative", label: "Collaborative" },
  { id: "case", label: "Case" },
];

export const STUDY_FOLDER_COLORS = [
  { id: "primary", value: "" },
  { id: "red", value: "hsl(0 84% 60%)" },
  { id: "orange", value: "hsl(25 95% 53%)" },
  { id: "yellow", value: "hsl(48 96% 53%)" },
  { id: "green", value: "hsl(142 71% 45%)" },
  { id: "blue", value: "hsl(217 91% 60%)" },
  { id: "purple", value: "hsl(262 83% 58%)" },
  { id: "pink", value: "hsl(330 81% 60%)" },
  { id: "cyan", value: "hsl(186 94% 41%)" },
] as const;

export function studyFolderColor(color?: string | null): string {
  return color?.trim() || "hsl(var(--primary))";
}

const YOUTUBE_ID = "([A-Za-z0-9_-]{11})";
const YOUTUBE_URL = new RegExp(
  `^(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/(?:watch\\?(?:[^\\s]*&)?v=|embed\\/|shorts\\/)|youtu\\.be\\/)${YOUTUBE_ID}(?:[&?#].*)?$`,
  "i",
);

export const EMPTY_STUDY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function parseYouTubeId(text: string): string | null {
  const match = text.trim().match(YOUTUBE_URL);
  return match?.[1] ?? null;
}

export type StudyVideoCorner = "tl" | "tr" | "bl" | "br";

export type StudyVideoAttrs = {
  id: string;
  videoId: string | null;
  src: string | null;
  title: string | null;
  width: number;
  pip: boolean;
  pipCorner: StudyVideoCorner;
  locked: boolean;
  active: boolean;
  dual: boolean;
  /** Whether this video is visible in the study player area. */
  shown: boolean;
  timestampsEnabled: boolean;
  /** Playback resume position in seconds. */
  startAt: number;
};

export function newStudyVideoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const STUDY_VIDEO_MIN_WIDTH = 280;
export const STUDY_VIDEO_DEFAULT_WIDTH = 720;
export const STUDY_VIDEO_PIP_WIDTH = 320;
/** Dual companion left docked while the other is PiP — match PiP rail so notes keep room. */
export const STUDY_VIDEO_DOCK_COMPANION_WIDTH = STUDY_VIDEO_PIP_WIDTH;
export const STUDY_VIDEO_PIP_INSET = 12;
export const STUDY_VIDEO_DUAL_GAP = 10;
export const STUDY_VIDEO_CORNERS: StudyVideoCorner[] = ["tl", "tr", "bl", "br"];

/** Max PiP width so the stack stays inside the notes area border. */
export function pipMaxWidthFromBounds(
  boxWidth: number,
  boxHeight: number,
  stackCount = 1,
  inset = STUDY_VIDEO_PIP_INSET,
): number {
  const stacks = Math.max(1, Math.floor(stackCount));
  // Keep room for the notes column — never more than half the notes area width.
  const byWidth = Math.floor(Math.max(0, boxWidth) / 2);
  if (stacks <= 1) {
    return Math.max(STUDY_VIDEO_MIN_WIDTH, byWidth);
  }
  // Dual (and taller) stacks must also fit vertically inside the notes area.
  const availableHeight = Math.max(
    0,
    boxHeight - inset * 2 - (stacks - 1) * STUDY_VIDEO_DUAL_GAP,
  );
  const byHeight = Math.floor((availableHeight * 16) / (9 * stacks));
  return Math.max(STUDY_VIDEO_MIN_WIDTH, Math.min(byWidth, byHeight));
}

function coerceVideoWidth(value: unknown, legacySize?: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(Math.max(STUDY_VIDEO_MIN_WIDTH, value));
  }
  if (legacySize === "s") return 448;
  if (legacySize === "l") return 1024;
  return STUDY_VIDEO_DEFAULT_WIDTH;
}

function coerceVideoCorner(value: unknown): StudyVideoCorner {
  return value === "tl" || value === "tr" || value === "bl" || value === "br" ? value : "br";
}

function coerceStartAt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function defaultStudyVideoAttrs(partial?: Partial<StudyVideoAttrs> & { size?: unknown; placement?: unknown }): StudyVideoAttrs {
  return {
    id: typeof partial?.id === "string" && partial.id ? partial.id : newStudyVideoId(),
    videoId: partial?.videoId ?? null,
    src: partial?.src ?? null,
    title: partial?.title ?? null,
    width: coerceVideoWidth(partial?.width, partial?.size),
    pip: partial?.pip ?? false,
    pipCorner: coerceVideoCorner(partial?.pipCorner),
    locked: partial?.locked ?? false,
    active: partial?.active ?? false,
    dual: partial?.dual ?? false,
    shown: partial?.shown ?? true,
    timestampsEnabled: partial?.timestampsEnabled ?? true,
    startAt: coerceStartAt(partial?.startAt),
  };
}

/** Keep `dual` in sync with visibility: companion = shown and not main. */
export function syncShownDualFlags(
  list: StudyVideoAttrs[],
  activeId: string | null,
): { list: StudyVideoAttrs[]; activeId: string | null } {
  const shown = list.filter((item) => item.shown);
  const mainId =
    (activeId && shown.some((item) => item.id === activeId) ? activeId : null) ??
    shown[0]?.id ??
    activeId;
  const companionId = shown.find((item) => item.id !== mainId)?.id ?? null;
  return {
    activeId: mainId,
    list: list.map((item) => ({
      ...item,
      dual: companionId != null && item.id === companionId,
      active: item.id === mainId,
    })),
  };
}

export function cornerStyle(corner: StudyVideoCorner, inset = 12, stackIndex = 0): CSSProperties {
  const base: CSSProperties = { position: "absolute", zIndex: 40 + stackIndex };
  if (corner === "tl") return { ...base, top: inset, left: inset };
  if (corner === "tr") return { ...base, top: inset, right: inset };
  if (corner === "bl") return { ...base, bottom: inset, left: inset };
  return { ...base, bottom: inset, right: inset };
}

/** Stack a second PiP under (or above) the primary by video height. */
export function dualStackOffset(
  corner: StudyVideoCorner,
  videoWidth: number,
  stackIndex: number,
  inset = STUDY_VIDEO_PIP_INSET,
): CSSProperties {
  if (stackIndex <= 0) return cornerStyle(corner, inset, 0);
  const width = Math.max(videoWidth, STUDY_VIDEO_MIN_WIDTH);
  const height = Math.round((width * 9) / 16);
  const shift = stackIndex * (height + STUDY_VIDEO_DUAL_GAP);
  const base = cornerStyle(corner, inset, stackIndex);
  if (corner === "tl" || corner === "tr") return { ...base, top: inset + shift };
  return { ...base, bottom: inset + shift };
}

/** Reserve note space so floating PiP doesn't cover the writing area. */
export function pipNoteOffsetStyle(
  corner: StudyVideoCorner,
  videoWidth: number,
  inset = 12,
): CSSProperties {
  const width = Math.max(videoWidth, STUDY_VIDEO_MIN_WIDTH);
  // Video inset + gap before line + line + gap before notes.
  const gap = inset + 10 + 12;
  if (corner === "tl" || corner === "bl") return { paddingLeft: width + gap };
  return { paddingRight: width + gap };
}

/** Position for a thin divider between PiP video and notes. */
export function pipNoteDividerStyle(
  corner: StudyVideoCorner,
  videoWidth: number,
  inset = 12,
): CSSProperties {
  const width = Math.max(videoWidth, STUDY_VIDEO_MIN_WIDTH);
  // Keep a small breath of space between the video edge and the line.
  const fromVideo = inset + 10;
  if (corner === "tl" || corner === "bl") return { left: width + fromVideo };
  return { right: width + fromVideo };
}

export function nearestCorner(
  x: number,
  y: number,
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
): StudyVideoCorner {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const left = cx < boxWidth / 2;
  const top = cy < boxHeight / 2;
  if (top && left) return "tl";
  if (top && !left) return "tr";
  if (!top && left) return "bl";
  return "br";
}

export function studyVideoNode(attrs: StudyVideoAttrs): JSONContent {
  return { type: "studyYoutube", attrs: { ...attrs } };
}

export function studyDocWith(block: JSONContent): JSONContent {
  return { type: "doc", content: [block, { type: "paragraph" }] };
}

export function videoBlockFromLink(raw: string, title?: string | null): JSONContent | null {
  const text = raw.trim();
  if (!text) return null;
  const videoId = parseYouTubeId(text);
  if (videoId) {
    return studyVideoNode(defaultStudyVideoAttrs({ videoId, src: null, title: title ?? null }));
  }
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return studyVideoNode(defaultStudyVideoAttrs({ videoId: null, src: url.toString(), title: title ?? null }));
  } catch {
    return null;
  }
}

export function youtubeThumbUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/** Resolve a YouTube video title via oEmbed (no API key). */
export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  const id = videoId.trim();
  if (!id) return null;
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: unknown };
    return typeof data.title === "string" && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null;
  }
}

export function formatStudyVideoTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function parseStudyVideoAttrs(attrs: Record<string, unknown> | undefined): StudyVideoAttrs | null {
  const videoId = typeof attrs?.videoId === "string" && attrs.videoId ? attrs.videoId : null;
  const src = typeof attrs?.src === "string" && attrs.src ? attrs.src : null;
  if (!videoId && !src) return null;
  const legacyWithoutShown = attrs != null && !("shown" in attrs);
  return defaultStudyVideoAttrs({
    id: typeof attrs?.id === "string" ? attrs.id : undefined,
    videoId,
    src,
    title: typeof attrs?.title === "string" ? attrs.title : null,
    width: typeof attrs?.width === "number" ? attrs.width : undefined,
    size: attrs?.size,
    pip: typeof attrs?.pip === "boolean" ? attrs.pip : undefined,
    pipCorner: attrs?.pipCorner as StudyVideoCorner | undefined,
    locked: typeof attrs?.locked === "boolean" ? attrs.locked : undefined,
    active: typeof attrs?.active === "boolean" ? attrs.active : undefined,
    dual: typeof attrs?.dual === "boolean" ? attrs.dual : undefined,
    // Pre-shown notes: only the main / dual companion were visible.
    shown: typeof attrs?.shown === "boolean"
      ? attrs.shown
      : legacyWithoutShown
        ? Boolean(attrs?.active || attrs?.dual)
        : true,
    timestampsEnabled: typeof attrs?.timestampsEnabled === "boolean" ? attrs.timestampsEnabled : undefined,
    startAt: typeof attrs?.startAt === "number" ? attrs.startAt : undefined,
  });
}

export function splitStudyVideos(doc: JSONContent | null | undefined): {
  videos: StudyVideoAttrs[];
  activeId: string | null;
  doc: JSONContent;
} {
  const videos: StudyVideoAttrs[] = [];
  const content = (doc?.content ?? []).filter((node) => {
    if (node.type !== "studyYoutube") return true;
    const parsed = parseStudyVideoAttrs(node.attrs as Record<string, unknown> | undefined);
    if (parsed) videos.push(parsed);
    return false;
  });
  let activeId = videos.find((item) => item.active)?.id ?? videos[0]?.id ?? null;
  let normalized = videos.map((item) => ({ ...item, active: item.id === activeId }));
  if (normalized.length > 0 && !normalized.some((item) => item.shown)) {
    normalized = normalized.map((item) => ({
      ...item,
      shown: item.id === activeId,
    }));
  }
  const synced = syncShownDualFlags(normalized, activeId);
  return {
    videos: synced.list,
    activeId: synced.activeId,
    doc: { type: "doc", content: content.length ? content : [{ type: "paragraph" }] },
  };
}

/** @deprecated Prefer splitStudyVideos for multi-resource notes. */
export function splitStudyVideo(doc: JSONContent | null | undefined): {
  video: StudyVideoAttrs | null;
  doc: JSONContent;
} {
  const split = splitStudyVideos(doc);
  return { video: split.videos.find((item) => item.id === split.activeId) ?? null, doc: split.doc };
}

export function studyDocPlainText(doc: JSONContent | null | undefined): string {
  const parts: string[] = [];
  const visit = (node: JSONContent | undefined) => {
    if (!node) return;
    if (node.type === "text" && node.text) parts.push(node.text);
    node.content?.forEach(visit);
  };
  visit(doc ?? undefined);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function splitStudyTrades(doc: JSONContent | null | undefined): { doc: JSONContent; tradeIds: string[] } {
  const tradeIds: string[] = [];
  const content = (doc?.content ?? []).filter((node) => {
    if (node.type === "studyTrade" && typeof node.attrs?.tradeId === "string" && node.attrs.tradeId) {
      tradeIds.push(node.attrs.tradeId);
      return false;
    }
    return true;
  });
  return {
    doc: { type: "doc", content: content.length ? content : [{ type: "paragraph" }] },
    tradeIds: [...new Set(tradeIds)],
  };
}

export function tradeIdsInDoc(doc: JSONContent | null | undefined): string[] {
  const ids: string[] = [];
  const visit = (node: JSONContent | undefined) => {
    if (!node) return;
    if (node.type === "studyTrade" && typeof node.attrs?.tradeId === "string" && node.attrs.tradeId) {
      ids.push(node.attrs.tradeId);
    }
    node.content?.forEach(visit);
  };
  visit(doc ?? undefined);
  return [...new Set(ids)];
}

export function matchSlashTrade(textBeforeCaret: string): { start: number; query: string } | null {
  const match = textBeforeCaret.match(/(^|\s)\/trade(?:[ \t]+([^\n]*))?$/i);
  if (!match || match.index == null) return null;
  const start = match[1] ? match.index + match[1].length : match.index;
  return { start, query: (match[2] || "").trim() };
}

export function formatStudyTradeWhen(trade: Trade): { date: string; time: string } {
  const instant = trade.openTime || trade.closeTime;
  if (instant) {
    const parsed = new Date(instant);
    if (!isNaN(parsed.getTime())) {
      return {
        date: parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: parsed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };
    }
  }
  const key = getTradeLocalDateKey(trade);
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return {
      date: parseLocalDateKey(key).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: "—",
    };
  }
  return { date: trade.date || "—", time: "—" };
}

export function isFolderDescendant(
  folders: { id: string; parent_id: string | null }[],
  ancestorId: string,
  maybeChildId: string,
): boolean {
  let current = folders.find((folder) => folder.id === maybeChildId);
  const guard = new Set<string>();
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    if (guard.has(current.id)) return false;
    guard.add(current.id);
    current = folders.find((folder) => folder.id === current?.parent_id);
  }
  return false;
}
