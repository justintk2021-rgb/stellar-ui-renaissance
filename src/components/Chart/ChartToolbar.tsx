import { Button } from "@/components/ui/button";
import {
  MousePointer2,
  Pencil,
  TrendingUp,
  Minus,
  Square,
  Circle,
  Type,
  Trash2,
  Undo,
  CandlestickChart,
  LineChart,
  AreaChart,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type DrawingTool = "select" | "line" | "trendline" | "rectangle" | "circle" | "text" | "draw";
export type ChartType = "candlestick" | "line" | "area";
export type Timeframe = "1" | "5" | "15" | "60" | "240" | "D";

interface ChartToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  onClear: () => void;
  onUndo: () => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const colors = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff", "#a3a3a3",
];

const tools: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
  { id: "select", icon: <MousePointer2 className="w-4 h-4" />, label: "Select" },
  { id: "draw", icon: <Pencil className="w-4 h-4" />, label: "Free Draw" },
  { id: "line", icon: <Minus className="w-4 h-4" />, label: "Line" },
  { id: "trendline", icon: <TrendingUp className="w-4 h-4" />, label: "Trendline" },
  { id: "rectangle", icon: <Square className="w-4 h-4" />, label: "Rectangle" },
  { id: "circle", icon: <Circle className="w-4 h-4" />, label: "Circle" },
  { id: "text", icon: <Type className="w-4 h-4" />, label: "Text" },
];

const timeframes: { id: Timeframe; label: string }[] = [
  { id: "1", label: "1m" },
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1H" },
  { id: "240", label: "4H" },
  { id: "D", label: "1D" },
];

const chartTypes: { id: ChartType; icon: React.ReactNode; label: string }[] = [
  { id: "candlestick", icon: <CandlestickChart className="w-4 h-4" />, label: "Candlestick" },
  { id: "line", icon: <LineChart className="w-4 h-4" />, label: "Line" },
  { id: "area", icon: <AreaChart className="w-4 h-4" />, label: "Area" },
];

export function ChartToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onClear,
  onUndo,
  chartType,
  onChartTypeChange,
  timeframe,
  onTimeframeChange,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Timeframe Selector */}
      <div className="flex items-center gap-0.5 p-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg mr-1">
        {timeframes.map((tf) => (
          <Button
            key={tf.id}
            variant={timeframe === tf.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onTimeframeChange(tf.id)}
            className="h-7 px-2 text-xs"
          >
            {tf.label}
          </Button>
        ))}
      </div>

      {/* Chart Type Selector */}
      <div className="flex items-center gap-0.5 p-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg mr-1">
        {chartTypes.map((type) => (
          <Button
            key={type.id}
            variant={chartType === type.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onChartTypeChange(type.id)}
            title={type.label}
            className="h-7 w-7 p-0"
          >
            {type.icon}
          </Button>
        ))}
      </div>

      {/* Drawing Tools */}
      <div className="flex items-center gap-0.5 p-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={activeTool === tool.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            className="h-7 w-7 p-0"
          >
            {tool.icon}
          </Button>
        ))}

        <div className="w-px h-5 bg-border mx-0.5" />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <div
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: activeColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    activeColor === color ? "border-primary" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => onColorChange(color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-0.5" />

        <Button variant="ghost" size="sm" onClick={onUndo} title="Undo" className="h-7 w-7 p-0">
          <Undo className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} title="Clear All" className="h-7 w-7 p-0">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
