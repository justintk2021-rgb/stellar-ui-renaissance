import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import type { AppTheme } from "@/lib/theme";

interface ThemeToggleProps {
  onThemeChange?: (theme: AppTheme) => void;
  className?: string;
}

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ onThemeChange, className }, ref) => {
    const theme = useDocumentTheme();
    const isDark = theme === "dark";

    const handleClick = () => {
      onThemeChange?.(isDark ? "light" : "dark");
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={handleClick}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
          "border border-border/50 bg-muted/60",
          "hover:bg-muted/80 hover:border-border/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.97] transition-transform duration-100",
          className
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full",
            "bg-background shadow-sm ring-1 ring-border/30",
            "transition-transform duration-150 ease-out",
            isDark && "translate-x-5"
          )}
        >
          {isDark ? (
            <Moon className="h-3 w-3 text-indigo-400" strokeWidth={2.5} />
          ) : (
            <Sun className="h-3 w-3 text-amber-500" strokeWidth={2.5} />
          )}
        </span>
      </button>
    );
  }
);

ThemeToggle.displayName = "ThemeToggle";

export { ThemeToggle };
