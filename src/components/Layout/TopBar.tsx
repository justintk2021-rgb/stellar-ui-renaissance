import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RankBadge } from "@/components/Dashboard/RankBadge";
import { Greeting } from "@/components/Layout/Greeting";

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
}

export function TopBar({ title, subtitle, theme, onThemeChange, trades = [], showRank = false, greetingName, showGreeting = false }: TopBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 mb-6">
      <div>
        {showGreeting && <Greeting name={greetingName} />}
        <h2 className="text-xl font-semibold tracking-wide">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
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
        <Badge variant="secondary" className="px-3 py-1 text-xs font-medium text-muted-foreground">
          ATP • Private
        </Badge>
      </div>
    </div>
  );
}
