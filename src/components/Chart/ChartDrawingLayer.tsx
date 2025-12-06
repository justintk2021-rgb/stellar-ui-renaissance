import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Line, Rect, Circle, IText, PencilBrush, Triangle } from "fabric";
import { toast } from "sonner";

interface ChartDrawingLayerProps {
  width: number;
  height: number;
  isActive: boolean;
  activeTool: string;
  activeColor: string;
}

export function ChartDrawingLayer({
  width,
  height,
  isActive,
  activeTool,
  activeColor,
}: ChartDrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const activeLineRef = useRef<Line | null>(null);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || width === 0 || height === 0) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "transparent",
      selection: activeTool === "select",
    });

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = 2;

    fabricRef.current = canvas;

    return () => {
      canvas.dispose();
    };
  }, [width, height]);

  // Update canvas size
  useEffect(() => {
    if (fabricRef.current && width > 0 && height > 0) {
      fabricRef.current.setDimensions({ width, height });
    }
  }, [width, height]);

  // Update brush color
  useEffect(() => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = activeColor;
    }
  }, [activeColor]);

  // Handle tool changes
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    canvas.isDrawingMode = activeTool === "draw";
    canvas.selection = activeTool === "select";

    if (activeTool !== "line" && activeTool !== "trendline" && activeTool !== "arrow" && activeTool !== "crosshair" && activeTool !== "fibonacci") {
      setIsDrawingLine(false);
      setLineStart(null);
      activeLineRef.current = null;
    }

    canvas.getObjects().forEach((obj) => {
      obj.selectable = activeTool === "select";
      obj.evented = activeTool === "select";
    });

    canvas.renderAll();
  }, [activeTool]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!fabricRef.current || !isActive) return;

      const canvas = fabricRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Line-based tools
      if (["line", "trendline", "arrow", "crosshair", "fibonacci"].includes(activeTool)) {
        if (!isDrawingLine) {
          setIsDrawingLine(true);
          setLineStart({ x, y });

          let lineColor = activeColor;
          if (activeTool === "trendline") lineColor = "#22c55e";
          if (activeTool === "crosshair") lineColor = "#6366f1";

          const line = new Line([x, y, x, y], {
            stroke: lineColor,
            strokeWidth: activeTool === "crosshair" ? 1 : 2,
            strokeDashArray: activeTool === "crosshair" ? [5, 5] : undefined,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          activeLineRef.current = line;
        }
      } else if (activeTool === "rectangle") {
        const rectangle = new Rect({
          left: x - 50,
          top: y - 30,
          width: 100,
          height: 60,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        canvas.add(rectangle);
        toast.success("Rectangle added - switch to Select to move/resize");
      } else if (activeTool === "circle") {
        const circle = new Circle({
          left: x - 30,
          top: y - 30,
          radius: 30,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        canvas.add(circle);
        toast.success("Circle added");
      } else if (activeTool === "text") {
        const text = new IText("Label", {
          left: x,
          top: y,
          fontSize: 14,
          fill: activeColor,
          fontFamily: "Inter, sans-serif",
          selectable: false,
          evented: false,
        });
        canvas.add(text);
        toast.success("Text added - double click in Select mode to edit");
      }

      canvas.renderAll();
    },
    [activeTool, isActive, isDrawingLine, activeColor]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!fabricRef.current || !isDrawingLine || !activeLineRef.current) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // For crosshair, extend lines to edges
      if (activeTool === "crosshair" && lineStart) {
        // Horizontal line
        activeLineRef.current.set({ x1: 0, y1: y, x2: width, y2: y });
      } else {
        activeLineRef.current.set({ x2: x, y2: y });
      }
      
      fabricRef.current.renderAll();
    },
    [isDrawingLine, activeTool, lineStart, width]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawingLine && activeLineRef.current && fabricRef.current) {
      setIsDrawingLine(false);
      setLineStart(null);

      // For arrow, add arrowhead
      if (activeTool === "arrow" && activeLineRef.current) {
        const line = activeLineRef.current;
        const x1 = line.x1 || 0;
        const y1 = line.y1 || 0;
        const x2 = line.x2 || 0;
        const y2 = line.y2 || 0;
        
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 15;
        
        const triangle = new Triangle({
          left: x2,
          top: y2,
          width: headLength,
          height: headLength,
          fill: activeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        
        fabricRef.current.add(triangle);
      }

      // For fibonacci, add levels
      if (activeTool === "fibonacci" && lineStart && activeLineRef.current) {
        const line = activeLineRef.current;
        const y1 = line.y1 || 0;
        const y2 = line.y2 || 0;
        const x1 = line.x1 || 0;
        const x2 = line.x2 || 0;
        
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const range = y2 - y1;
        
        levels.forEach((level) => {
          const yLevel = y1 + range * level;
          const fibLine = new Line([Math.min(x1, x2) - 50, yLevel, Math.max(x1, x2) + 50, yLevel], {
            stroke: level === 0.5 ? "#f59e0b" : "#6b7280",
            strokeWidth: 1,
            strokeDashArray: [3, 3],
            selectable: false,
            evented: false,
          });
          fabricRef.current?.add(fibLine);
          
          const label = new IText(`${(level * 100).toFixed(1)}%`, {
            left: Math.max(x1, x2) + 55,
            top: yLevel - 7,
            fontSize: 10,
            fill: "#a1a1aa",
            fontFamily: "Inter, sans-serif",
            selectable: false,
            evented: false,
          });
          fabricRef.current?.add(label);
        });
        
        // Remove the original drag line
        fabricRef.current.remove(activeLineRef.current);
      }

      activeLineRef.current.set({ selectable: false, evented: false });
      activeLineRef.current = null;
      
      const toolName = activeTool === "crosshair" ? "Price level" : 
                       activeTool === "fibonacci" ? "Fibonacci levels" :
                       activeTool.charAt(0).toUpperCase() + activeTool.slice(1);
      toast.success(`${toolName} drawn`);
    }
  }, [isDrawingLine, activeTool, lineStart, activeColor]);

  // Handle clear drawings event
  useEffect(() => {
    const handleClear = () => {
      if (fabricRef.current) {
        fabricRef.current.clear();
        fabricRef.current.backgroundColor = "transparent";
        fabricRef.current.renderAll();
        toast.success("Drawings cleared");
      }
    };

    window.addEventListener("chart:clear-drawings", handleClear);
    return () => window.removeEventListener("chart:clear-drawings", handleClear);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fabricRef.current) return;

      // Delete selected objects
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeObjects = fabricRef.current.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((obj) => fabricRef.current?.remove(obj));
          fabricRef.current.discardActiveObject();
          fabricRef.current.renderAll();
          toast.success("Deleted");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-10 ${
        isActive ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
