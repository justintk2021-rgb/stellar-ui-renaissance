import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface TopBarProps {
  title: string;
  subtitle: string;
  theme?: 'dark' | 'light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
}

export function TopBar({ title, subtitle, theme, onThemeChange }: TopBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6">
      <div>
        <h2 className="text-xl font-semibold tracking-wide">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
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
