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
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type DrawingTool = "select" | "line" | "trendline" | "rectangle" | "circle" | "text" | "draw";

interface ChartToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  onClear: () => void;
  onUndo: () => void;
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

export function ChartToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onClear,
  onUndo,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg">
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant={activeTool === tool.id ? "default" : "ghost"}
          size="sm"
          onClick={() => onToolChange(tool.id)}
          title={tool.label}
          className="h-8 w-8 p-0"
        >
          {tool.icon}
        </Button>
      ))}

      <div className="w-px h-6 bg-border mx-1" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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

      <div className="w-px h-6 bg-border mx-1" />

      <Button variant="ghost" size="sm" onClick={onUndo} title="Undo" className="h-8 w-8 p-0">
        <Undo className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} title="Clear All" className="h-8 w-8 p-0">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
