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
      className="inline-flex items-center rounded-full bg-muted/50 p-1"
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
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId="study-category-bubble"
                className="absolute inset-0 rounded-full bg-background/80 shadow-sm"
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
