import { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RankBadge } from "@/components/Dashboard/RankBadge";
import { Greeting } from "@/components/Layout/Greeting";
import { cn } from "@/lib/utils";
import type { AppTheme } from "@/lib/theme";
import type { Trade } from "@/types/trade";

interface TopBarProps {
  title: string;
  subtitle: string;
  onThemeChange?: (theme: AppTheme) => void;
  trades?: Trade[];
  showRank?: boolean;
  greetingName?: string | null;
  profileReady?: boolean;
  showGreeting?: boolean;
  rightSlot?: ReactNode;
  notificationsSlot?: ReactNode;
  /** Journal and Study Area. The active segment is the current view. */
  viewSwitch?: {
    value: "notebook" | "study";
    onChange: (value: "notebook" | "study") => void;
  } | null;
  centerSlot?: ReactNode;
}

const VIEW_SWITCH = [
  { id: "notebook" as const, label: "Journal" },
  { id: "study" as const, label: "Study Area" },
];

export function TopBar({ title, subtitle, onThemeChange, trades = [], showRank = false, greetingName, profileReady = true, showGreeting = false, rightSlot, notificationsSlot, viewSwitch, centerSlot }: TopBarProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 pb-3 sm:pb-4 mb-4 sm:mb-6 sm:gap-4",
      centerSlot ? "sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center" : "sm:flex-row sm:items-end sm:justify-between",
    )}>
      <div className="relative z-20 min-w-0 overflow-visible">
        {showGreeting && <Greeting name={greetingName} profileReady={profileReady} />}
        <h2 className={cn("relative inline-flex max-w-full items-baseline", showGreeting && "mt-4 sm:mt-5")}>
          <span className="text-lg sm:text-xl font-semibold tracking-wide truncate">{title}</span>
        </h2>
        {viewSwitch && (
          <div
            role="tablist"
            aria-label="Journal or Study Area"
            className="mt-2 inline-flex rounded-full bg-muted/50 p-1"
          >
            {VIEW_SWITCH.map((option) => {
              const selected = viewSwitch.value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => viewSwitch.onChange(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
        {!showGreeting && subtitle ? (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
        ) : null}
      </div>
      {centerSlot ? <div className="flex justify-center">{centerSlot}</div> : null}
      <div className={cn("flex items-center gap-2 sm:gap-3 flex-wrap", centerSlot ? "sm:justify-end" : "sm:justify-end")}>
        {rightSlot}
        {showRank && (
          <RankBadge trades={trades} />
        )}
        {onThemeChange && (
          <ThemeToggle onThemeChange={onThemeChange} />
        )}
        {notificationsSlot}
      </div>
    </div>
  );
}
