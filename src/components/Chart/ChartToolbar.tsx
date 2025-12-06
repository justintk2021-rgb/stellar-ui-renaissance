import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  MousePointer2,
  Minus,
  Square,
  Circle,
  Type,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

interface ChartSymbol {
  label: string;
  value: string;
}

interface ChartToolbarProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  activeTool: string;
  onToolChange: (tool: string) => void;
  symbols: ChartSymbol[];
  timeframes: { label: string; value: string }[];
}

const drawingTools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "trendline", icon: TrendingUp, label: "Trend Line" },
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
  { id: "draw", icon: Pencil, label: "Free Draw" },
];

export function ChartToolbar({
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  activeTool,
  onToolChange,
  symbols,
  timeframes,
}: ChartToolbarProps) {
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = () => {
    if (searchInput.trim()) {
      const formatted = searchInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
      onSymbolChange(formatted);
      setSearchInput("");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Symbol Search */}
      <div className="flex items-center gap-1.5 min-w-[160px] max-w-[200px]">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search..."
            className="pl-8 h-8 text-sm bg-background/50"
          />
        </div>
      </div>

      {/* Symbol Select */}
      <Select value={symbol} onValueChange={onSymbolChange}>
        <SelectTrigger className="w-[100px] h-8 bg-background/50 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {symbols.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Timeframe Buttons */}
      <div className="flex items-center gap-0.5 bg-background/50 rounded-md p-0.5 border border-border/50">
        {timeframes.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onIntervalChange(tf.value)}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              interval === tf.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border/50 mx-1" />

      {/* Drawing Tools */}
      <TooltipProvider delayDuration={100}>
        <div className="flex items-center gap-0.5 bg-background/50 rounded-md p-0.5 border border-border/50">
          {drawingTools.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange(tool.id)}
                  className={`p-1.5 rounded transition-colors ${
                    activeTool === tool.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <tool.icon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tool.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Clear Drawings */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => {
                // Will be handled by ChartDrawingLayer via event
                window.dispatchEvent(new CustomEvent("chart:clear-drawings"));
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Clear All Drawings
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
