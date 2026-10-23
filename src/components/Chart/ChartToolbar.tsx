import { Minus, MousePointer2, Square, Spline, Trash2, Sigma } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrawingTool } from "./drawings";

interface ChartToolbarProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onDeleteAll: () => void;
}

const TOOLS: Array<{ id: DrawingTool; label: string; icon: typeof Minus }> = [
  { id: "cursor", label: "Cursor", icon: MousePointer2 },
  { id: "hline", label: "Horizontal line", icon: Minus },
  { id: "trend", label: "Trendline", icon: Spline },
  { id: "rect", label: "Rectangle", icon: Square },
];

export function ChartToolbar({ tool, onToolChange, onDeleteAll }: ChartToolbarProps) {
  return (
    <div className="liquid-glass flex shrink-0 flex-row items-center gap-1 rounded-2xl p-1.5 lg:flex-col">
      {TOOLS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => onToolChange(item.id)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              tool === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}

      <button
        type="button"
        disabled
        title="Fibonacci — soon"
        aria-label="Fibonacci coming soon"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground/50"
      >
        <Sigma className="h-4 w-4" />
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wide text-amber-500">
          soon
        </span>
      </button>

      <div className="mx-1 hidden h-px w-6 bg-foreground/10 lg:block" />

      <button
        type="button"
        title="Delete all drawings"
        aria-label="Delete all drawings"
        onClick={onDeleteAll}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
