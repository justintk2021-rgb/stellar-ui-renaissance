import { motion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { STUDY_CATEGORIES, type StudyCategory } from "@/lib/studyArea";

export function StudyCategorySwitch({
  value,
  onChange,
}: {
  value: StudyCategory;
  onChange: (category: StudyCategory) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Study category"
      className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 p-1 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
    >
      {STUDY_CATEGORIES.map((category) => {
        const selected = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(category.id)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4",
              selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId="study-category-bubble"
                className="absolute inset-0 rounded-full border border-primary/35 bg-primary/15 shadow-[0_6px_18px_-8px_hsl(var(--primary)/0.9)]"
                transition={{ type: "spring", stiffness: 460, damping: 34 }}
              />
            )}
            <span className="relative z-10">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
