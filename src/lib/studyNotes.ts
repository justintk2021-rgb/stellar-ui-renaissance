import type { NotebookEntry, Trade } from "@/types/trade";
import { getTradeLocalDateKey, parseLocalDateKey } from "@/lib/tradeFormat";

export const TRADE_EMBED_CLASS = "study-trade-embed";
export const YOUTUBE_EMBED_CLASS = "study-youtube";
export const FOLDERS_STORAGE_PREFIX = "nsync-study-folders-";
export const LEGACY_FOLDERS_KEY = "notebook-custom-folders";

export interface StudyFolder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  sort: number;
}

const YOUTUBE_ID = "([A-Za-z0-9_-]{11})";
const YOUTUBE_URL = new RegExp(
  `(?:https?:\\/\\/)?(?:www\\.)?(?:youtube\\.com\\/(?:watch\\?(?:[^\\s]*&)?v=|embed\\/|shorts\\/)|youtu\\.be\\/)${YOUTUBE_ID}`,
  "i",
);

export function foldersStorageKey(userId: string): string {
  return `${FOLDERS_STORAGE_PREFIX}${userId || "guest"}`;
}

function isFolder(value: unknown): value is StudyFolder {
  if (!value || typeof value !== "object") return false;
  const folder = value as StudyFolder;
  return typeof folder.id === "string" && typeof folder.name === "string";
}

export function loadFolders(userId: string): StudyFolder[] {
  try {
    const raw = localStorage.getItem(foldersStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isFolder).map((folder, index) => ({
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId ?? null,
          color: folder.color,
          sort: typeof folder.sort === "number" ? folder.sort : index,
        }));
      }
    }

    const legacy = localStorage.getItem(LEGACY_FOLDERS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        return parsed.map((folder: { id?: string; label?: string; name?: string; color?: string }, index: number) => ({
          id: String(folder.id || crypto.randomUUID()),
          name: String(folder.label || folder.name || "Folder"),
          parentId: null,
          color: folder.color,
          sort: index,
        }));
      }
    }
  } catch {
    // Ignore malformed localStorage and start with an empty tree.
  }
  return [];
}

export function saveFolders(userId: string, folders: StudyFolder[]): void {
  localStorage.setItem(foldersStorageKey(userId), JSON.stringify(folders));
}

export function folderChildIds(folders: StudyFolder[], parentId: string | null): string[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map((folder) => folder.id);
}

export function folderDescendantIds(folders: StudyFolder[], id: string): string[] {
  const ids: string[] = [];
  for (const childId of folderChildIds(folders, id)) {
    ids.push(childId, ...folderDescendantIds(folders, childId));
  }
  return ids;
}

export function isDescendantFolder(folders: StudyFolder[], ancestorId: string, maybeChildId: string): boolean {
  return folderDescendantIds(folders, ancestorId).includes(maybeChildId);
}

export function canMoveFolder(
  folders: StudyFolder[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (folderId === newParentId) return false;
  if (newParentId && isDescendantFolder(folders, folderId, newParentId)) return false;
  return folders.some((folder) => folder.id === folderId);
}

export function moveFolder(
  folders: StudyFolder[],
  folderId: string,
  newParentId: string | null,
): StudyFolder[] {
  if (!canMoveFolder(folders, folderId, newParentId)) return folders;
  const siblings = folders.filter((folder) => folder.parentId === newParentId && folder.id !== folderId);
  const nextSort = siblings.reduce((max, folder) => Math.max(max, folder.sort), -1) + 1;
  return folders.map((folder) =>
    folder.id === folderId ? { ...folder, parentId: newParentId, sort: nextSort } : folder,
  );
}

export function resolveNoteFolderId(entry: NotebookEntry, folders: StudyFolder[]): string | null {
  if (entry.folderId) return entry.folderId;
  if (entry.category && folders.some((folder) => folder.id === entry.category)) return entry.category;
  return null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function tradeEmbedHtml(tradeId: string): string {
  return `<div class="${TRADE_EMBED_CLASS}" data-trade-id="${escapeAttr(tradeId)}" contenteditable="false"></div>`;
}

export function extractTradeIdsFromHtml(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /data-trade-id=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const id = match[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function mentionedTradeIds(entry: Pick<NotebookEntry, "content" | "tradeId">): string[] {
  const ids = extractTradeIdsFromHtml(entry.content || "");
  if (entry.tradeId && !ids.includes(entry.tradeId)) ids.unshift(entry.tradeId);
  return ids;
}

export function notesMentioningTrade(
  entries: NotebookEntry[],
  tradeId: string,
): NotebookEntry[] {
  return entries
    .filter((entry) => !entry.isDeleted && mentionedTradeIds(entry).includes(tradeId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function parseYouTubeId(text: string): string | null {
  const match = text.trim().match(YOUTUBE_URL);
  return match?.[1] ?? null;
}

export function youtubeEmbedHtml(videoId: string): string {
  const id = encodeURIComponent(videoId);
  return `<div class="${YOUTUBE_EMBED_CLASS}" data-youtube-id="${escapeAttr(videoId)}" contenteditable="false"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
}

export function replaceYouTubeUrlsWithEmbeds(text: string): { html: string; replaced: boolean } {
  const global = new RegExp(YOUTUBE_URL.source, "gi");
  let replaced = false;
  const html = text.replace(global, (_full, id: string) => {
    replaced = true;
    return youtubeEmbedHtml(id);
  });
  return { html, replaced };
}

export function matchSlashTrade(textBeforeCaret: string): { start: number; query: string } | null {
  const match = textBeforeCaret.match(/(^|\s)\/trade(?:[ \t]+([^\n]*))?$/i);
  if (!match) return null;
  const tokenStart = match[1] ? match.index! + match[1].length : match.index!;
  return {
    start: tokenStart,
    query: (match[2] || "").trim(),
  };
}

export function serializeNoteHtml(root: HTMLElement): string {
  const output = root.cloneNode(true) as HTMLElement;
  output.querySelectorAll(`.${TRADE_EMBED_CLASS}`).forEach((node) => {
    const el = node as HTMLElement;
    const tradeId = el.getAttribute("data-trade-id") || "";
    el.innerHTML = "";
    el.setAttribute("contenteditable", "false");
    el.className = TRADE_EMBED_CLASS;
    if (tradeId) el.setAttribute("data-trade-id", tradeId);
  });
  return output.innerHTML;
}

export function seedStudyNoteHtml(tradeId: string, bodyHtml: string): string {
  const embed = tradeEmbedHtml(tradeId);
  return bodyHtml ? `${embed}${bodyHtml}` : embed;
}

export function filterTradesForSlash(trades: Trade[], query: string): Trade[] {
  const needle = query.trim().toLowerCase();
  const sorted = [...trades].sort((a, b) => {
    const aTime = a.openTime || a.closeTime || a.date || "";
    const bTime = b.openTime || b.closeTime || b.date || "";
    return bTime.localeCompare(aTime);
  });
  if (!needle) return sorted;
  return sorted.filter((trade) => {
    const haystack = [trade.pair, trade.direction, trade.session, trade.notes, trade.date]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function formatStudyTradeWhen(trade: Trade): { date: string; time: string } {
  const instant = trade.openTime || trade.closeTime;
  if (instant) {
    const parsed = new Date(instant);
    if (!isNaN(parsed.getTime())) {
      return {
        date: parsed.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: parsed.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    }
  }

  const key = getTradeLocalDateKey(trade);
  if (key && key !== "Unknown" && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const parsed = parseLocalDateKey(key);
    return {
      date: parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: "—",
    };
  }

  return { date: trade.date || "—", time: "—" };
}
