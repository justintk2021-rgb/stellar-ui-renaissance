import { ReactNode, useState } from "react";
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
  /** Hover swaps the title text to this destination. Click switches views. */
  titleSwitch?: { label: string; onSelect: () => void } | null;
  centerSlot?: ReactNode;
}

export function TopBar({ title, subtitle, onThemeChange, trades = [], showRank = false, greetingName, profileReady = true, showGreeting = false, rightSlot, notificationsSlot, titleSwitch, centerSlot }: TopBarProps) {
  const [titleHovered, setTitleHovered] = useState(false);
  const titleText = titleSwitch && titleHovered ? titleSwitch.label : title;

  const titleBlock = (
    <div className="min-w-0 overflow-visible">
      {showGreeting && <Greeting name={greetingName} profileReady={profileReady} />}
      <h2 className={cn("inline-flex max-w-full items-baseline", showGreeting && "mt-4 sm:mt-5")}>
        {titleSwitch ? (
          <button
            type="button"
            onClick={titleSwitch.onSelect}
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
            onFocus={() => setTitleHovered(true)}
            onBlur={() => setTitleHovered(false)}
            className="truncate border-0 bg-transparent p-0 text-lg font-semibold tracking-wide text-inherit hover:text-primary hover:underline sm:text-xl"
          >
            {titleText}
          </button>
        ) : (
          <span className="truncate text-lg font-semibold tracking-wide sm:text-xl">{title}</span>
        )}
      </h2>
      {!showGreeting && subtitle ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
      ) : null}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      {rightSlot}
      {showRank && <RankBadge trades={trades} />}
      {onThemeChange && <ThemeToggle onThemeChange={onThemeChange} />}
      {notificationsSlot}
    </div>
  );

  if (centerSlot) {
    return (
      <div className="relative mb-4 grid grid-cols-1 items-center gap-3 pb-3 sm:mb-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 sm:pb-4">
        <div className="min-w-0">{titleBlock}</div>
        <div className="flex justify-center justify-self-center">{centerSlot}</div>
        <div className="min-w-0 sm:justify-self-end">{actions}</div>
      </div>
    );
  }

  return (
    <div className="relative mb-4 flex flex-col gap-3 pb-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-4">
      {titleBlock}
      <div className="sm:ml-auto">{actions}</div>
    </div>
  );
}
