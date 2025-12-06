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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ArrowUpRight,
  Target,
  Palette,
  Hash,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ChartSymbol {
  label: string;
  value: string;
  isLive?: boolean;
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
  activeColor: string;
  onColorChange: (color: string) => void;
}

const drawingTools = [
  { id: "select", icon: MousePointer2, label: "Select (V)" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "trendline", icon: TrendingUp, label: "Trend Line" },
  { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
  { id: "draw", icon: Pencil, label: "Free Draw" },
  { id: "crosshair", icon: Target, label: "Price Level" },
  { id: "fibonacci", icon: Hash, label: "Fibonacci" },
];

const colorPresets = [
  "#ef4444", // Red
  "#f59e0b", // Amber
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#ffffff", // White
  "#6b7280", // Gray
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
  activeColor,
  onColorChange,
}: ChartToolbarProps) {
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = () => {
    if (searchInput.trim()) {
      const formatted = searchInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
      onSymbolChange(formatted);
      setSearchInput("");
    }
  };

  const currentSymbol = symbols.find((s) => s.value === symbol);

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
        <SelectTrigger className="w-[130px] h-8 bg-background/50 text-sm">
          <div className="flex items-center gap-1.5">
            <SelectValue />
            {currentSymbol?.isLive && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {symbols.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <div className="flex items-center gap-2">
                {s.label}
                {s.isLive && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    LIVE
                  </Badge>
                )}
              </div>
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

      {/* Color Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
          >
            <div 
              className="w-5 h-5 rounded-full border-2 border-border"
              style={{ backgroundColor: activeColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground font-medium">Drawing Color</p>
            <div className="flex gap-1.5">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  onClick={() => onColorChange(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    activeColor === color ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Input
              type="color"
              value={activeColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-8 w-full cursor-pointer"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear Drawings */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => {
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
