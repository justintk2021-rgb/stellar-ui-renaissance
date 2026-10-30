import { ReactNode, type MouseEvent } from "react";
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
  /** Hidden until the title is hovered. Click switches the page. */
  titleSwitch?: { label: string; onSelect: (event: MouseEvent<HTMLButtonElement>) => void } | null;
  centerSlot?: ReactNode;
}

export function TopBar({ title, subtitle, onThemeChange, trades = [], showRank = false, greetingName, profileReady = true, showGreeting = false, rightSlot, notificationsSlot, titleSwitch, centerSlot }: TopBarProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 pb-3 sm:pb-4 mb-4 sm:mb-6 sm:gap-4",
      centerSlot ? "sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center" : "sm:flex-row sm:items-end sm:justify-between",
    )}>
      <div className="relative z-20 min-w-0 overflow-visible">
        {showGreeting && <Greeting name={greetingName} profileReady={profileReady} />}
        <h2 className={cn("group/title relative inline-flex max-w-full items-baseline", showGreeting && "mt-4 sm:mt-5")}>
          <span className="text-lg sm:text-xl font-semibold tracking-wide truncate">{title}</span>
          {titleSwitch && (
            <button
              type="button"
              onClick={(event) => titleSwitch.onSelect(event)}
              className="absolute left-0 top-full z-30 mt-1 whitespace-nowrap text-lg font-semibold tracking-wide text-primary opacity-0 translate-y-1 scale-90 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/title:translate-y-0 group-hover/title:scale-100 group-hover/title:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100 focus-visible:translate-y-0 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-none sm:text-xl"
            >
              {titleSwitch.label}
            </button>
          )}
        </h2>
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
