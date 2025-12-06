import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, PencilBrush, Line, Rect, Circle, Textbox } from "fabric";
import { 
  MousePointer2, 
  Pencil, 
  Minus, 
  Square, 
  CircleIcon, 
  Type, 
  Trash2, 
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
  "#ef4444", "#f97316", "#eab308", "#22c55e", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
];

export function ChartDrawingLayer({ width, height, symbol, onSave, savedData }: ChartDrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState("select");
  const [activeColor, setActiveColor] = useState("#3b82f6");
  const [isVisible, setIsVisible] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const drawingRef = useRef<{ startX: number; startY: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || width <= 0 || height <= 0) return;

    // Dispose previous canvas if exists
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    try {
      const canvas = new FabricCanvas(canvasRef.current, {
        width,
        height,
        backgroundColor: "transparent",
        selection: true,
      });

      fabricRef.current = canvas;
      setIsReady(true);

      // Load saved drawings
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          canvas.loadFromJSON(parsed, () => {
            canvas.renderAll();
          });
        } catch (e) {
          console.log("No valid saved data");
        }
      }

      // Auto-save on changes
      const saveHandler = () => {
        if (fabricRef.current) {
          const json = JSON.stringify(fabricRef.current.toJSON());
          onSave(json);
        }
      };

      canvas.on("object:added", saveHandler);
      canvas.on("object:modified", saveHandler);
      canvas.on("object:removed", saveHandler);

      return () => {
        canvas.off("object:added", saveHandler);
        canvas.off("object:modified", saveHandler);
        canvas.off("object:removed", saveHandler);
        canvas.dispose();
        fabricRef.current = null;
        setIsReady(false);
      };
    } catch (error) {
      console.error("Failed to initialize canvas:", error);
    }
  }, [width, height, symbol]);

  // Handle tool changes
  useEffect(() => {
    if (!fabricRef.current || !isReady) return;

    const canvas = fabricRef.current;
    
    if (activeTool === "draw") {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 2;
    } else {
      canvas.isDrawingMode = false;
    }

    canvas.selection = activeTool === "select";
    canvas.getObjects().forEach((obj) => {
      obj.selectable = activeTool === "select";
      obj.evented = activeTool === "select";
    });
    canvas.renderAll();
  }, [activeTool, activeColor, isReady]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!fabricRef.current || activeTool === "select" || activeTool === "draw") return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    drawingRef.current = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
    };
  }, [activeTool]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (!fabricRef.current || !drawingRef.current) return;

    const canvas = fabricRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { startX, startY } = drawingRef.current;
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    let shape = null;

    switch (activeTool) {
      case "line":
        shape = new Line([startX, startY, endX, endY], {
          stroke: activeColor,
          strokeWidth: 2,
          selectable: true,
        });
        break;
      case "rect":
        shape = new Rect({
          left: Math.min(startX, endX),
          top: Math.min(startY, endY),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
          stroke: activeColor,
          strokeWidth: 2,
          fill: "transparent",
          selectable: true,
        });
        break;
      case "circle":
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2;
        shape = new Circle({
          left: (startX + endX) / 2 - radius,
          top: (startY + endY) / 2 - radius,
          radius: Math.max(radius, 5),
          stroke: activeColor,
          strokeWidth: 2,
          fill: "transparent",
          selectable: true,
        });
        break;
      case "text":
        shape = new Textbox("Text", {
          left: startX,
          top: startY,
          fontSize: 18,
          fill: activeColor,
          fontFamily: "Arial",
          selectable: true,
          editable: true,
        });
        break;
    }

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }

    drawingRef.current = null;
  }, [activeTool, activeColor]);

  const handleClear = () => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.renderAll();
    onSave("");
  };

  const handleDeleteSelected = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObjects();
    if (active.length > 0) {
      active.forEach(obj => fabricRef.current?.remove(obj));
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
    }
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
        className="absolute top-2 left-2 z-30 bg-background/90 hover:bg-background gap-1.5"
      >
        <Eye className="w-4 h-4" />
        Show Drawings
      </Button>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-30 flex flex-col gap-1 bg-background/95 backdrop-blur-sm rounded-lg border border-border/50 p-1.5 shadow-lg">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              size="icon"
              variant={activeTool === tool.id ? "default" : "ghost"}
              onClick={() => setActiveTool(tool.id)}
              className={cn("h-8 w-8", activeTool === tool.id && "bg-primary")}
              title={tool.label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}

        <div className="h-px bg-border my-1" />

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Color">
              <div className="w-5 h-5 rounded-full border-2 border-border" style={{ backgroundColor: activeColor }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1.5">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setActiveColor(color)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                    activeColor === color ? "border-white ring-2 ring-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-px bg-border my-1" />

        <Button size="icon" variant="ghost" onClick={handleDeleteSelected} className="h-8 w-8" title="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleExport} className="h-8 w-8" title="Export">
          <Download className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setIsVisible(false)} className="h-8 w-8" title="Hide">
          <EyeOff className="w-4 h-4" />
        </Button>
      </div>

      {/* Drawing Canvas */}
      <div 
        className="absolute inset-0 z-20"
        style={{ pointerEvents: activeTool === "select" ? "none" : "auto" }}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
      >
        <canvas ref={canvasRef} />
      </div>
    </>
  );
}