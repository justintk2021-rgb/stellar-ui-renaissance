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
  /** When true, this rule counts toward confluence scoring. */
  isConfluence?: boolean;
}

export type ChecklistType = "fixed" | "conditional";

export interface Checklist {
  id: string;
  name: string;
  type: ChecklistType;
  items: ChecklistItem[];
  notes: string;
  createdAt: string;
  idealImage?: string | null;
}

export type ConfluenceScore = {
  checked: number;
  total: number;
};

/** Break-and-retest defaults — only used when a checklist has zero items. */
export const BREAK_AND_RETEST_DEFAULTS: Omit<ChecklistItem, "id">[] = [
  { text: "4H break of swing high/low", checked: false, isConfluence: true },
  { text: "Pullback / retest of the broken level", checked: false, isConfluence: true },
  { text: "1H structure confirms (lower highs / higher lows)", checked: false, isConfluence: true },
  { text: "15M free candle, then engulfing candle", checked: false, isConfluence: true },
  { text: "Intentional breakout candle", checked: false, isConfluence: true },
];

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
      idealImage: (c.ideal_image as string | null | undefined) ?? null,
    };
  }

  return {
    id: String(c.id ?? ""),
    name: String(c.name ?? ""),
    type: items?.type === "conditional" ? "conditional" : "fixed",
    items: Array.isArray(items?.items) ? items.items : [],
    notes: (c.notes as string) || "",
    createdAt: String(c.created_at ?? ""),
    idealImage: (c.ideal_image as string | null | undefined) ?? null,
  };
}

type ChecklistStateLike = { id: string; checked?: boolean } | null | undefined;

/**
 * Score a trade against checklist confluence items.
 * Returns null when the trade is not scored (no confluences, or no checklist_state).
 */
export function scoreTradeConfluence(
  checklist: Pick<Checklist, "items">,
  tradeChecklistState: ChecklistStateLike[] | null | undefined,
): ConfluenceScore | null {
  const confluences = checklist.items.filter((item) => item.isConfluence);
  if (confluences.length === 0) return null;
  if (!tradeChecklistState || !Array.isArray(tradeChecklistState)) return null;

  const byId = new Map(tradeChecklistState.map((entry) => [entry.id, entry]));
  let checked = 0;
  for (const item of confluences) {
    if (byId.get(item.id)?.checked) checked += 1;
  }
  return { checked, total: confluences.length };
}
