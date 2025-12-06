import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";
import { Canvas as FabricCanvas, Line, Rect, Circle, IText, PencilBrush } from "fabric";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ChartToolbar, DrawingTool } from "./ChartToolbar";

// Generate mock historical data
function generateMockData(symbol: string): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  const now = Date.now();
  let price = symbol.includes("BTC") ? 95000 : symbol.includes("ETH") ? 3500 : 100;
  
  for (let i = 500; i >= 0; i--) {
    const time = Math.floor((now - i * 15 * 60 * 1000) / 1000) as Time;
    const volatility = price * 0.002;
    const open = price;
    const close = open + (Math.random() - 0.5) * volatility * 2;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    
    data.push({ time, open, high, low, close });
    price = close;
  }
  
  return data;
}

export function LightweightChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  
  const [symbol, setSymbol] = useState("BTCUSD");
  const [searchValue, setSearchValue] = useState("");
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [activeColor, setActiveColor] = useState("#3b82f6");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempShape, setTempShape] = useState<any>(null);

  // Initialize lightweight-charts
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#a3a3a3",
      },
      grid: {
        vertLines: { color: "rgba(39, 39, 42, 0.5)" },
        horzLines: { color: "rgba(39, 39, 42, 0.5)" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "rgba(39, 39, 42, 0.5)",
      },
      timeScale: {
        borderColor: "rgba(39, 39, 42, 0.5)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    seriesRef.current = series;
    series.setData(generateMockData(symbol));
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when symbol changes
  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData(generateMockData(symbol));
      chartRef.current?.timeScale().fitContent();
    }
  }, [symbol]);

  // Initialize Fabric.js canvas overlay
  useEffect(() => {
    if (!canvasContainerRef.current || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const existingCanvas = canvasContainerRef.current.querySelector("canvas");
    if (existingCanvas) existingCanvas.remove();

    const canvasEl = document.createElement("canvas");
    canvasEl.id = "drawing-canvas";
    canvasContainerRef.current.appendChild(canvasEl);

    const fabric = new FabricCanvas(canvasEl, {
      width: container.clientWidth,
      height: container.clientHeight,
      selection: activeTool === "select",
      backgroundColor: "transparent",
    });

    fabricRef.current = fabric;

    if (fabric.freeDrawingBrush) {
      fabric.freeDrawingBrush.color = activeColor;
      fabric.freeDrawingBrush.width = 2;
    }

    const handleResize = () => {
      fabric.setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      fabric.renderAll();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      fabric.dispose();
    };
  }, []);

  // Update fabric canvas mode based on tool
  useEffect(() => {
    if (!fabricRef.current) return;
    const fabric = fabricRef.current;

    fabric.isDrawingMode = activeTool === "draw";
    fabric.selection = activeTool === "select";

    if (activeTool === "draw" && fabric.freeDrawingBrush) {
      fabric.freeDrawingBrush.color = activeColor;
      fabric.freeDrawingBrush.width = 2;
    }

    // Disable object selection when using drawing tools
    fabric.forEachObject((obj) => {
      obj.selectable = activeTool === "select";
      obj.evented = activeTool === "select";
    });
    fabric.renderAll();
  }, [activeTool, activeColor]);

  // Handle mouse events for shape drawing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!fabricRef.current || activeTool === "select" || activeTool === "draw") return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });

    if (activeTool === "text") {
      const text = new IText("Text", {
        left: x,
        top: y,
        fill: activeColor,
        fontSize: 16,
        fontFamily: "sans-serif",
      });
      fabricRef.current.add(text);
      fabricRef.current.setActiveObject(text);
      text.enterEditing();
      setActiveTool("select");
    }
  }, [activeTool, activeColor]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || !fabricRef.current) return;
    if (activeTool === "select" || activeTool === "draw" || activeTool === "text") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Remove temp shape
    if (tempShape) {
      fabricRef.current.remove(tempShape);
    }

    let shape: any = null;

    if (activeTool === "line" || activeTool === "trendline") {
      shape = new Line([startPoint.x, startPoint.y, x, y], {
        stroke: activeColor,
        strokeWidth: 2,
        selectable: false,
      });
    } else if (activeTool === "rectangle") {
      const width = x - startPoint.x;
      const height = y - startPoint.y;
      shape = new Rect({
        left: width > 0 ? startPoint.x : x,
        top: height > 0 ? startPoint.y : y,
        width: Math.abs(width),
        height: Math.abs(height),
        fill: "transparent",
        stroke: activeColor,
        strokeWidth: 2,
        selectable: false,
      });
    } else if (activeTool === "circle") {
      const radius = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));
      shape = new Circle({
        left: startPoint.x - radius,
        top: startPoint.y - radius,
        radius,
        fill: "transparent",
        stroke: activeColor,
        strokeWidth: 2,
        selectable: false,
      });
    }

    if (shape) {
      fabricRef.current.add(shape);
      setTempShape(shape);
      fabricRef.current.renderAll();
    }
  }, [isDrawing, startPoint, activeTool, activeColor, tempShape]);

  const handleMouseUp = useCallback(() => {
    if (tempShape && fabricRef.current) {
      tempShape.set({ selectable: true, evented: true });
      fabricRef.current.renderAll();
    }
    setIsDrawing(false);
    setStartPoint(null);
    setTempShape(null);
  }, [tempShape]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      setSymbol(searchValue.trim().toUpperCase());
    }
  };

  const handleClear = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = "transparent";
      fabricRef.current.renderAll();
    }
  };

  const handleUndo = () => {
    if (fabricRef.current) {
      const objects = fabricRef.current.getObjects();
      if (objects.length > 0) {
        fabricRef.current.remove(objects[objects.length - 1]);
        fabricRef.current.renderAll();
      }
    }
  };

  return (
    <div className="flex flex-col animate-fade-in -mt-2" style={{ height: "calc(100vh - 180px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-10 bg-background/50 border-border/50 w-48"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{symbol}</span>
          </span>
        </div>

        <ChartToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          activeColor={activeColor}
          onColorChange={setActiveColor}
          onClear={handleClear}
          onUndo={handleUndo}
        />
      </div>

      {/* Chart Container */}
      <div 
        className="flex-1 relative rounded-lg overflow-hidden border border-border/50 bg-[#0a0a0a]"
        style={{ minHeight: "600px" }}
      >
        <div ref={chartContainerRef} className="absolute inset-0" />
        <div 
          ref={canvasContainerRef}
          className="absolute inset-0 z-10"
          style={{ pointerEvents: activeTool === "select" && !isDrawing ? "none" : "auto" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
}
