import * as React from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
}

const spring = { type: "spring" as const, stiffness: 520, damping: 32, mass: 0.7 };

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ checked, onCheckedChange, className, size = "default" }, ref) => {
    const sizeClasses = {
      sm: "h-8 w-[4.25rem] p-0.5",
      default: "h-9 w-[4.75rem] p-0.5",
      lg: "h-10 w-[5.25rem] p-1",
    };

    const iconSizes = {
      sm: "h-3.5 w-3.5",
      default: "h-4 w-4",
      lg: "h-4 w-4",
    };

    const thumbSizes = {
      sm: "h-7 w-[calc(50%-2px)]",
      default: "h-8 w-[calc(50%-2px)]",
      lg: "h-8 w-[calc(50%-4px)]",
    };

    return (
      <motion.button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={checked ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => onCheckedChange(!checked)}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        className={cn(
          "group relative inline-flex shrink-0 cursor-pointer items-center rounded-full",
          "border border-border/60 bg-muted/40 shadow-sm backdrop-blur-sm",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "hover:border-border hover:bg-muted/55 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          sizeClasses[size],
          className
        )}
      >
        <motion.span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-full",
            "bg-background shadow-sm ring-1 ring-border/40 will-change-transform",
            thumbSizes[size]
          )}
          animate={{ x: checked ? "calc(100% + 2px)" : 0 }}
          transition={spring}
        />

        <span className="relative z-10 flex flex-1 items-center justify-center">
          <motion.span
            animate={{
              scale: !checked ? 1.12 : 0.82,
              rotate: !checked ? 0 : -90,
              opacity: !checked ? 1 : 0.4,
            }}
            transition={spring}
            className={cn(!checked ? "text-amber-500" : "text-muted-foreground/45 group-hover:text-muted-foreground/70")}
          >
            <Sun className={iconSizes[size]} strokeWidth={2.25} />
          </motion.span>
        </span>

        <span className="relative z-10 flex flex-1 items-center justify-center">
          <motion.span
            animate={{
              scale: checked ? 1.12 : 0.82,
              rotate: checked ? 0 : 90,
              opacity: checked ? 1 : 0.4,
            }}
            transition={spring}
            className={cn(checked ? "text-indigo-400" : "text-muted-foreground/45 group-hover:text-muted-foreground/70")}
          >
            <Moon className={iconSizes[size]} strokeWidth={2.25} />
          </motion.span>
        </span>
      </motion.button>
    );
  }
);

ThemeToggle.displayName = "ThemeToggle";

export { ThemeToggle };
