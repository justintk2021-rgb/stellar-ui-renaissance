export const HOME_TAB_KEY = "home";

export type StudyTab =
  | { key: typeof HOME_TAB_KEY; kind: "home"; title: "Home" }
  | { key: `note:${string}`; kind: "note"; id: string; title: string; color?: string | null }
  | { key: `board:${string}`; kind: "board"; id: string; title: string; color?: string | null };

export const HOME_TAB: StudyTab = { key: HOME_TAB_KEY, kind: "home", title: "Home" };

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
