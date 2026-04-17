import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RankBadge } from "@/components/Dashboard/RankBadge";
import { Greeting } from "@/components/Layout/Greeting";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  date: string;
  result: number;
  checklist_id?: string | null;
  checklist_state?: any;
}

interface TopBarProps {
  title: string;
  subtitle: string;
  theme?: 'dark' | 'light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
  trades?: Trade[];
  showRank?: boolean;
  greetingName?: string | null;
  showGreeting?: boolean;
  rightSlot?: ReactNode;
}

export function TopBar({ title, subtitle, theme, onThemeChange, trades = [], showRank = false, greetingName, showGreeting = false, rightSlot }: TopBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 mb-4 sm:mb-6">
      <div className="min-w-0">
        {showGreeting && <Greeting name={greetingName} />}
        <h2 className={cn("text-lg sm:text-xl font-semibold tracking-wide truncate", showGreeting && "mt-4 sm:mt-5")}>{title}</h2>
        {!showGreeting && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:justify-end">
        {rightSlot}
        {showRank && (
          <RankBadge trades={trades} />
        )}
        {onThemeChange && (
          <ThemeToggle
            checked={theme === 'dark'}
            onCheckedChange={(checked) => onThemeChange(checked ? 'dark' : 'light')}
            size="sm"
          />
        )}
        <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium text-muted-foreground hidden sm:inline-flex">
          ATP • Private
        </Badge>
      </div>
    </div>
  );
}
