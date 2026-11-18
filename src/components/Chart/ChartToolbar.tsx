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
    <div className="flex shrink-0 flex-row items-center gap-0 border-b border-[#2a2e39] bg-[#131722] lg:flex-col lg:border-b-0 lg:border-r">
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
              "flex h-8 w-8 items-center justify-center transition-colors",
              tool === item.id
                ? "bg-[#2962FF] text-white"
                : "text-[#787b86] hover:bg-white/5 hover:text-[#d1d4dc]",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        );
      })}

      <button
        type="button"
        disabled
        title="Fibonacci — soon"
        aria-label="Fibonacci coming soon"
        className="relative flex h-8 w-8 items-center justify-center text-[#4c525e]"
      >
        <Sigma className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[7px] font-semibold uppercase leading-none tracking-wide text-amber-500">
          soon
        </span>
      </button>

      <div className="mx-1 hidden h-px w-5 bg-[#2a2e39] lg:block" />

      <button
        type="button"
        title="Delete all drawings"
        aria-label="Delete all drawings"
        onClick={onDeleteAll}
        className="flex h-8 w-8 items-center justify-center text-[#787b86] hover:bg-white/5 hover:text-[#f23645]"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
