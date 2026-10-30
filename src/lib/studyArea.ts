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
