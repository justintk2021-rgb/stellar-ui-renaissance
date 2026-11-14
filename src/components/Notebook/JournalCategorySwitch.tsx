import { motion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const JOURNAL_CATEGORY_TABS = [
  { id: "all", label: "Notes" },
  { id: "journal", label: "Psychology" },
] as const;

export type JournalCategoryTabId = (typeof JOURNAL_CATEGORY_TABS)[number]["id"];

export function JournalCategorySwitch({
  value,
  onChange,
}: {
  value: string;
  onChange: (category: JournalCategoryTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Note categories"
      className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto scrollbar-hide rounded-full bg-muted/50 p-1"
    >
      {JOURNAL_CATEGORY_TABS.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-4",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId="journal-category-bubble"
                className="absolute inset-0 rounded-full bg-background/80 shadow-sm"
                transition={{ type: "spring", stiffness: 620, damping: 38, mass: 0.7 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
