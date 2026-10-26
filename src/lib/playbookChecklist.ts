export interface ConditionalSubItem {
  id: string;
  text: string;
  checked: boolean;
  children?: ConditionalSubItem[];
}

export type PercentageType = "fixed" | "conditional";

export interface ChecklistSubItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  children?: ConditionalSubItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  percentageType?: PercentageType;
  subItems?: ChecklistSubItem[];
}

export type ChecklistType = "fixed" | "conditional";

export interface Checklist {
  id: string;
  name: string;
  type: ChecklistType;
  items: ChecklistItem[];
  notes: string;
  createdAt: string;
}

export function mapDbToChecklist(c: Record<string, unknown>): Checklist {
  const raw = c.items;
  const items = raw as unknown as { items?: ChecklistItem[]; type?: ChecklistType } | ChecklistItem[] | null;

  if (Array.isArray(items)) {
    return {
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      type: "fixed",
      items,
      notes: (c.notes as string) || "",
      createdAt: String(c.created_at ?? ""),
    };
  }

  return {
    id: String(c.id ?? ""),
    name: String(c.name ?? ""),
    type: items?.type === "conditional" ? "conditional" : "fixed",
    items: Array.isArray(items?.items) ? items.items : [],
    notes: (c.notes as string) || "",
    createdAt: String(c.created_at ?? ""),
  };
}
