import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  id: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

/** Signed-in pages. Prop Firm and Learning sit near the front so they stay on screen. */
export const appNavItems: AppNavItem[] = [
  { id: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { id: "journal", label: "Log", short: "Log", icon: FileText },
  { id: "propfirm", label: "Prop Firm", short: "Prop Firm", icon: Landmark },
  { id: "learning", label: "Learning", short: "Learning", icon: GraduationCap },
  { id: "chart", label: "Chart", short: "Chart", icon: BarChart3 },
  { id: "calendar", label: "Economic Calendar", short: "Calendar", icon: CalendarClock },
  { id: "playbook", label: "Playbook", short: "Playbook", icon: ClipboardList },
  { id: "notebook", label: "Journal", short: "Journal", icon: NotebookPen },
  { id: "community", label: "Community", short: "Chat", icon: Users },
  { id: "settings", label: "Settings", short: "Settings", icon: Settings },
];

const NAV_ORDER_KEY = "atp_nav_order";

export function readNavOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

export function saveNavOrder(ids: string[]) {
  try {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Apply a saved id order; unknown ids ignored, new default items appended. */
export function orderNavItems(orderIds: string[] | null | undefined): AppNavItem[] {
  if (!orderIds?.length) return appNavItems;
  const byId = new Map(appNavItems.map((item) => [item.id, item]));
  const ordered: AppNavItem[] = [];
  for (const id of orderIds) {
    const item = byId.get(id);
    if (!item) continue;
    ordered.push(item);
    byId.delete(id);
  }
  for (const item of byId.values()) ordered.push(item);
  return ordered;
}
