import {
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardList,
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
  { id: "journal", label: "Journal", short: "Journal", icon: BookOpen },
  { id: "propfirm", label: "Prop Firm", short: "Prop Firm", icon: Landmark },
  { id: "learning", label: "Learning", short: "Learning", icon: GraduationCap },
  { id: "chart", label: "Chart", short: "Chart", icon: BarChart3 },
  { id: "calendar", label: "Economic Calendar", short: "Calendar", icon: CalendarClock },
  { id: "playbook", label: "Playbook", short: "Playbook", icon: ClipboardList },
  { id: "notebook", label: "Study Notes", short: "Notes", icon: NotebookPen },
  { id: "community", label: "Community", short: "Chat", icon: Users },
  { id: "settings", label: "Settings", short: "Settings", icon: Settings },
];
