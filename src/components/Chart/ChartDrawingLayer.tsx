import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, PencilBrush, Line, Rect, Circle, Textbox, FabricObject } from "fabric";
import { 
  MousePointer2, 
  Pencil, 
  Minus, 
  Square, 
  CircleIcon, 
  Type, 
  Trash2, 
  Undo2,
  Redo2,
  Download,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ChartDrawingLayerProps {
  width: number;
  height: number;
  symbol: string;
  onSave: (data: string) => void;
  savedData: string | null;
}

const tools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "draw", icon: Pencil, label: "Free Draw" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: CircleIcon, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
];

const colors = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ffffff", // white
];

export function ChartDrawingLayer({ width, height, symbol, onSave, savedData }: ChartDrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState("select");
  const [activeColor, setActiveColor] = useState("#3b82f6");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || width === 0 || height === 0) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "transparent",
      selection: activeTool === "select",
    });

    fabricRef.current = canvas;

    // Load saved data if available
    if (savedData) {
      try {
        canvas.loadFromJSON(JSON.parse(savedData), () => {
          canvas.renderAll();
          saveToHistory();
        });
      } catch (e) {
        console.error("Error loading saved drawing:", e);
      }
    }

    // Save on object modified
    canvas.on("object:modified", saveDrawing);
    canvas.on("object:added", () => {
      saveDrawing();
      saveToHistory();
    });
    canvas.on("object:removed", () => {
      saveDrawing();
      saveToHistory();
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [width, height]);

  // Update canvas size when dimensions change
  useEffect(() => {
    if (fabricRef.current && width > 0 && height > 0) {
      fabricRef.current.setDimensions({ width, height });
      fabricRef.current.renderAll();
    }
  }, [width, height]);

  // Update drawing mode when tool changes
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    
    if (activeTool === "draw") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 2;
    } else {
      canvas.isDrawingMode = false;
    }

    canvas.selection = activeTool === "select";
    canvas.forEachObject((obj: FabricObject) => {
      obj.selectable = activeTool === "select";
      obj.evented = activeTool === "select";
    });
    canvas.renderAll();
  }, [activeTool, activeColor]);

  // Update brush color
  useEffect(() => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = activeColor;
    }
  }, [activeColor]);

  const saveDrawing = useCallback(() => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    onSave(json);
  }, [onSave]);

  const saveToHistory = useCallback(() => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(json);
      return newHistory.slice(-20); // Keep last 20 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 19));
  }, [historyIndex]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!fabricRef.current || activeTool === "select" || activeTool === "draw") return;

    const canvas = fabricRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPoint({ x, y });
    setIsDrawing(true);
  }, [activeTool]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!fabricRef.current || !isDrawing || !startPoint) return;

    const canvas = fabricRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    let shape: FabricObject | null = null;

    switch (activeTool) {
      case "line":
        shape = new Line([startPoint.x, startPoint.y, endX, endY], {
          stroke: activeColor,
          strokeWidth: 2,
        });
        break;
      case "rect":
        shape = new Rect({
          left: Math.min(startPoint.x, endX),
          top: Math.min(startPoint.y, endY),
          width: Math.abs(endX - startPoint.x),
          height: Math.abs(endY - startPoint.y),
          stroke: activeColor,
          strokeWidth: 2,
          fill: "transparent",
        });
        break;
      case "circle":
        const radius = Math.sqrt(
          Math.pow(endX - startPoint.x, 2) + Math.pow(endY - startPoint.y, 2)
        ) / 2;
        shape = new Circle({
          left: Math.min(startPoint.x, endX),
          top: Math.min(startPoint.y, endY),
          radius,
          stroke: activeColor,
          strokeWidth: 2,
          fill: "transparent",
        });
        break;
      case "text":
        shape = new Textbox("Text", {
          left: startPoint.x,
          top: startPoint.y,
          fontSize: 16,
          fill: activeColor,
          fontFamily: "sans-serif",
        });
        break;
    }

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }

    setIsDrawing(false);
    setStartPoint(null);
  }, [isDrawing, startPoint, activeTool, activeColor]);

  const handleClear = () => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = "transparent";
    fabricRef.current.renderAll();
    saveDrawing();
    saveToHistory();
  };

  const handleDeleteSelected = () => {
    if (!fabricRef.current) return;
    const activeObjects = fabricRef.current.getActiveObjects();
    activeObjects.forEach(obj => fabricRef.current?.remove(obj));
    fabricRef.current.discardActiveObject();
    fabricRef.current.renderAll();
    saveDrawing();
  };

  const handleUndo = () => {
    if (historyIndex <= 0 || !fabricRef.current) return;
    const newIndex = historyIndex - 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIndex]), () => {
      fabricRef.current?.renderAll();
      saveDrawing();
    });
    setHistoryIndex(newIndex);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1 || !fabricRef.current) return;
    const newIndex = historyIndex + 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIndex]), () => {
      fabricRef.current?.renderAll();
      saveDrawing();
    });
    setHistoryIndex(newIndex);
  };

  const handleExport = () => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({ format: "png", multiplier: 2 });
    const link = document.createElement("a");
    link.download = `chart-${symbol}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  if (!isVisible) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsVisible(true)}
        className="absolute top-2 left-2 z-30 bg-background/80 hover:bg-background gap-1.5"
      >
        <Eye className="w-4 h-4" />
        Show Drawing
      </Button>
    );
  }

  return (
    <>
      {/* Drawing Toolbar */}
      <div className="absolute top-2 left-2 z-30 flex flex-col gap-1 bg-background/95 backdrop-blur-sm rounded-lg border border-border/50 p-1.5 shadow-lg">
        {/* Tools */}
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              size="icon"
              variant={activeTool === tool.id ? "default" : "ghost"}
              onClick={() => setActiveTool(tool.id)}
              className={cn(
                "h-8 w-8",
                activeTool === tool.id && "bg-primary text-primary-foreground"
              )}
              title={tool.label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}

        <div className="h-px bg-border my-1" />

        {/* Color Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Color">
              <div
                className="w-5 h-5 rounded-full border-2 border-border"
                style={{ backgroundColor: activeColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setActiveColor(color)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                    activeColor === color ? "border-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-px bg-border my-1" />

        {/* Actions */}
        <Button
          size="icon"
          variant="ghost"
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="h-8 w-8"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="h-8 w-8"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDeleteSelected}
          className="h-8 w-8"
          title="Delete Selected"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleExport}
          className="h-8 w-8"
          title="Export"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsVisible(false)}
          className="h-8 w-8"
          title="Hide Drawing Layer"
        >
          <EyeOff className="w-4 h-4" />
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20"
        style={{ 
          pointerEvents: activeTool === "select" && !fabricRef.current?.getActiveObject() ? "none" : "auto",
          cursor: activeTool === "draw" ? "crosshair" : activeTool === "select" ? "default" : "crosshair"
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
    </>
  );
}