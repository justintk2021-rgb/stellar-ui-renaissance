import * as React from "react";
import { cn } from "@/lib/utils";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import type { AppTheme } from "@/lib/theme";
import { AnimatedThemeToggler } from "@/registry/magicui/animated-theme-toggler";

interface ThemeToggleProps {
  onThemeChange?: (theme: AppTheme) => void;
  className?: string;
}

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ onThemeChange, className }, ref) => {
    const theme = useDocumentTheme();

    return (
      <AnimatedThemeToggler
        ref={ref}
        theme={theme}
        onThemeChange={onThemeChange}
        duration={520}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className={cn(
          "relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full",
          "border border-border/50 bg-muted/60 text-foreground",
          "hover:bg-muted/80 hover:border-border/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.97] transition-transform duration-100",
          className,
        )}
      />
    );
  },
);

ThemeToggle.displayName = "ThemeToggle";

export { ThemeToggle };
