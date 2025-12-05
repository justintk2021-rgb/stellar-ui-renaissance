import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  title: string;
  subtitle: string;
}

const pageInfo: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your trading performance' },
  journal: { title: 'Journal', subtitle: 'Log and manage your trades' },
  notebook: { title: 'Notebook', subtitle: 'Detailed notes for each trade' },
};

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-border/50">
      <div>
        <h2 className="text-xl font-semibold tracking-wide">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="px-3 py-1 text-xs font-medium border-primary/30 text-muted-foreground">
          ATP • Private
        </Badge>
      </div>
    </div>
  );
}
