export const HOME_TAB_KEY = "home";

export type StudyTab =
  | { key: typeof HOME_TAB_KEY; kind: "home"; title: "Home" }
  | { key: `note:${string}`; kind: "note"; id: string; title: string; color?: string | null }
  | { key: `board:${string}`; kind: "board"; id: string; title: string; color?: string | null };

export const HOME_TAB: StudyTab = { key: HOME_TAB_KEY, kind: "home", title: "Home" };

export type PersistedTabSession = {
  tabs: StudyTab[];
  activeKey: string;
};

const EMPTY_SESSION: PersistedTabSession = {
  tabs: [HOME_TAB],
  activeKey: HOME_TAB_KEY,
};

function isStudyTab(value: unknown): value is StudyTab {
  if (!value || typeof value !== "object") return false;
  const tab = value as Record<string, unknown>;
  if (tab.kind === "home" && tab.key === HOME_TAB_KEY) return true;
  if (tab.kind === "note" && typeof tab.id === "string" && typeof tab.title === "string") {
    return tab.key === noteTabKey(tab.id);
  }
  if (tab.kind === "board" && typeof tab.id === "string" && typeof tab.title === "string") {
    return tab.key === boardTabKey(tab.id);
  }
  return false;
}

function normalizeSession(raw: unknown): PersistedTabSession {
  if (!raw || typeof raw !== "object") return EMPTY_SESSION;
  const data = raw as { tabs?: unknown; activeKey?: unknown };
  const tabs = Array.isArray(data.tabs) ? data.tabs.filter(isStudyTab) : [];
  const ensured = ensureHomeFirst(tabs.length ? tabs : [HOME_TAB]);
  const activeKey =
    typeof data.activeKey === "string" && ensured.some((tab) => tab.key === data.activeKey)
      ? data.activeKey
      : HOME_TAB_KEY;
  return { tabs: ensured, activeKey };
}

/** Load open tabs for a scoped session (survives leaving the page). */
export function loadTabSession(storageKey: string, scope: string): PersistedTabSession {
  if (typeof window === "undefined") return EMPTY_SESSION;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return EMPTY_SESSION;
    const all = JSON.parse(raw) as Record<string, unknown>;
    return normalizeSession(all[scope]);
  } catch {
    return EMPTY_SESSION;
  }
}

/** Persist open tabs for a scoped session. */
export function saveTabSession(storageKey: string, scope: string, session: PersistedTabSession): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(storageKey);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    all[scope] = {
      tabs: ensureHomeFirst(session.tabs),
      activeKey: session.activeKey || HOME_TAB_KEY,
    };
    localStorage.setItem(storageKey, JSON.stringify(all));
  } catch {
    /* ignore quota / private mode */
  }
}

export const STUDY_TAB_STORAGE_KEY = "nsync-study-open-tabs";
export const NOTEBOOK_TAB_STORAGE_KEY = "nsync-notebook-open-tabs";

export function noteTabKey(id: string): `note:${string}` {
  return `note:${id}`;
}

export function boardTabKey(id: string): `board:${string}` {
  return `board:${id}`;
}

export function ensureHomeFirst(tabs: StudyTab[]): StudyTab[] {
  const rest = tabs.filter((tab) => tab.kind !== "home");
  return [HOME_TAB, ...rest];
}

export function neighborAfterClose(tabs: StudyTab[], closingKey: string, activeKey: string): string {
  if (closingKey !== activeKey) return activeKey;
  const index = tabs.findIndex((tab) => tab.key === closingKey);
  if (index < 0) return HOME_TAB_KEY;
  const next = tabs[index + 1] ?? tabs[index - 1] ?? HOME_TAB;
  return next.key;
}

export function upsertNoteTab(
  tabs: StudyTab[],
  id: string,
  title: string,
  color?: string | null,
): StudyTab[] {
  const key = noteTabKey(id);
  const existing = tabs.find((tab) => tab.key === key);
  if (existing) {
    if (existing.kind === "note" && existing.title === title && existing.color === color) return tabs;
    return tabs.map((tab) => (tab.key === key ? { ...tab, title, color } : tab));
  }
  return ensureHomeFirst([...tabs, { key, kind: "note", id, title, color }]);
}

export function upsertBoardTab(
  tabs: StudyTab[],
  id: string,
  title: string,
  color?: string | null,
): StudyTab[] {
  const key = boardTabKey(id);
  const existing = tabs.find((tab) => tab.key === key);
  if (existing) {
    if (existing.kind === "board" && existing.title === title && existing.color === color) return tabs;
    return tabs.map((tab) => (tab.key === key ? { ...tab, title, color } : tab));
  }
  return ensureHomeFirst([...tabs, { key, kind: "board", id, title, color }]);
}

export function removeTab(tabs: StudyTab[], key: string): StudyTab[] {
  if (key === HOME_TAB_KEY) return ensureHomeFirst(tabs);
  return ensureHomeFirst(tabs.filter((tab) => tab.key !== key));
}

export function stripNoteTabs(tabs: StudyTab[]): StudyTab[] {
  return ensureHomeFirst(tabs.filter((tab) => tab.kind !== "note"));
}

export function syncNoteTabTitle(
  tabs: StudyTab[],
  id: string,
  title: string,
  color?: string | null,
): StudyTab[] {
  const key = noteTabKey(id);
  return tabs.map((tab) =>
    tab.key === key && tab.kind === "note" ? { ...tab, title, color: color ?? tab.color } : tab,
  );
}

export function syncBoardTabTitle(tabs: StudyTab[], id: string, title: string, color?: string | null): StudyTab[] {
  const key = boardTabKey(id);
  return tabs.map((tab) =>
    tab.key === key && tab.kind === "board" ? { ...tab, title, color: color ?? tab.color } : tab,
  );
}
