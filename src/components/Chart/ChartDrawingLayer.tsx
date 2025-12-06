import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Line, Rect, Circle, IText, PencilBrush } from "fabric";
import { toast } from "sonner";

interface ChartDrawingLayerProps {
  width: number;
  height: number;
  isActive: boolean;
  activeTool: string;
}

export function ChartDrawingLayer({
  width,
  height,
  isActive,
  activeTool,
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

    // Setup freehand drawing brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = "#f59e0b";
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

  // Handle tool changes
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    canvas.isDrawingMode = activeTool === "draw";
    canvas.selection = activeTool === "select";

    // Reset line drawing state when switching tools
    if (activeTool !== "line" && activeTool !== "trendline") {
      setIsDrawingLine(false);
      setLineStart(null);
      activeLineRef.current = null;
    }

    // Make objects selectable only in select mode
    canvas.getObjects().forEach((obj) => {
      obj.selectable = activeTool === "select";
      obj.evented = activeTool === "select";
    });

    canvas.renderAll();
  }, [activeTool]);

  // Handle mouse events for drawing shapes
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!fabricRef.current || !isActive) return;

      const canvas = fabricRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (activeTool === "line" || activeTool === "trendline") {
        if (!isDrawingLine) {
          setIsDrawingLine(true);
          setLineStart({ x, y });

          const line = new Line([x, y, x, y], {
            stroke: activeTool === "trendline" ? "#22c55e" : "#f59e0b",
            strokeWidth: 2,
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
          stroke: "#3b82f6",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        canvas.add(rectangle);
        toast.success("Rectangle added");
      } else if (activeTool === "circle") {
        const circle = new Circle({
          left: x - 30,
          top: y - 30,
          radius: 30,
          fill: "transparent",
          stroke: "#8b5cf6",
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
          fill: "#ffffff",
          fontFamily: "Inter, sans-serif",
          selectable: false,
          evented: false,
        });
        canvas.add(text);
        toast.success("Text added - double click to edit");
      }

      canvas.renderAll();
    },
    [activeTool, isActive, isDrawingLine]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!fabricRef.current || !isDrawingLine || !activeLineRef.current) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      activeLineRef.current.set({ x2: x, y2: y });
      fabricRef.current.renderAll();
    },
    [isDrawingLine]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawingLine && activeLineRef.current) {
      setIsDrawingLine(false);
      setLineStart(null);
      activeLineRef.current.set({ selectable: false, evented: false });
      activeLineRef.current = null;
      toast.success("Line drawn");
    }
  }, [isDrawingLine]);

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

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!fabricRef.current) return;

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
