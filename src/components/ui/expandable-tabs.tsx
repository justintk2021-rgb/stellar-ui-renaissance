import * as React from "react";
import { AnimatePresence, motion } from "@/lib/motion";
import { useOnClickOutside } from "usehooks-ts";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Tab {
  title: string;
  icon: LucideIcon;
  badge?: string | number;
  /** Optional photo — when set, shown instead of the lucide icon. */
  imageSrc?: string | null;
  imageFallback?: string;
  type?: never;
}

interface Separator {
  type: "separator";
  title?: never;
  icon?: never;
  badge?: never;
  imageSrc?: never;
  imageFallback?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
  tabs: TabItem[];
  className?: string;
  activeColor?: string;
  onChange?: (index: number | null) => void;
  /** Controlled selected index. Pass `null` when none are expanded. */
  selected?: number | null;
  /** Skip outside-click collapse (useful when a portaled popover is open). */
  closeOnOutsideClick?: boolean;
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".5rem",
    paddingRight: isSelected ? "1rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 };

export function ExpandableTabs({
  tabs,
  className,
  activeColor = "text-primary",
  onChange,
  selected: selectedProp,
  closeOnOutsideClick = true,
}: ExpandableTabsProps) {
  const [uncontrolledSelected, setUncontrolledSelected] = React.useState<number | null>(null);
  const isControlled = selectedProp !== undefined;
  const selected = isControlled ? selectedProp : uncontrolledSelected;
  const outsideClickRef = React.useRef<HTMLDivElement>(null);

  useOnClickOutside(outsideClickRef, () => {
    if (!closeOnOutsideClick) return;
    if (!isControlled) setUncontrolledSelected(null);
    onChange?.(null);
  });

  const handleSelect = (index: number) => {
    const next = selected === index ? null : index;
    if (!isControlled) setUncontrolledSelected(next);
    onChange?.(next);
  };

  const Separator = () => (
    <div className="mx-0.5 h-5 w-px bg-border/70" aria-hidden="true" />
  );

  return (
    <div
      ref={outsideClickRef}
      className={cn(
        "flex flex-wrap items-center gap-0.5 rounded-2xl border border-border/40 bg-background/80 p-1 shadow-sm backdrop-blur-md",
        className,
      )}
    >
      {tabs.map((tab, index) => {
        if ("type" in tab && tab.type === "separator") {
          return <Separator key={`separator-${index}`} />;
        }

        const Icon = tab.icon;
        const isSelected = selected === index;
        return (
          <motion.button
            key={tab.title}
            type="button"
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={isSelected}
            onClick={() => handleSelect(index)}
            transition={transition}
            aria-pressed={isSelected}
            className={cn(
              "relative flex items-center rounded-xl py-2 text-sm font-medium transition-colors duration-300",
              isSelected
                ? cn("bg-muted", activeColor)
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="relative inline-flex items-center justify-center">
              {tab.imageSrc ? (
                <img
                  src={tab.imageSrc}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover ring-1 ring-border/50"
                />
              ) : tab.imageFallback ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground ring-1 ring-border/50">
                  {tab.imageFallback}
                </span>
              ) : (
                <Icon size={20} aria-hidden />
              )}
              {tab.badge != null && tab.badge !== 0 && tab.badge !== "0" ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold tabular-nums text-primary-foreground">
                  {tab.badge}
                </span>
              ) : null}
            </span>
            <AnimatePresence initial={false}>
              {isSelected && (
                <motion.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
