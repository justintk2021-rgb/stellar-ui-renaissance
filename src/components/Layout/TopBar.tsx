import { Badge } from "@/components/ui/badge";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface TopBarProps {
  title: string;
  subtitle: string;
  theme?: 'dark' | 'light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
}

export function TopBar({ title, subtitle, theme, onThemeChange }: TopBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-border/50">
      <div>
        <h2 className="text-xl font-semibold tracking-wide">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        {onThemeChange && (
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-muted-foreground" />
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => onThemeChange(checked ? 'dark' : 'light')}
            />
            <Moon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <Badge variant="outline" className="px-3 py-1 text-xs font-medium border-primary/30 text-muted-foreground">
          ATP • Private
        </Badge>
      </div>
    </div>
  );
}
