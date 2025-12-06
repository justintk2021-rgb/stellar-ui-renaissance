import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, IChartApi, ISeriesApi, ColorType } from "lightweight-charts";
import { ChartToolbar } from "./ChartToolbar";
import { ChartDrawingLayer } from "./ChartDrawingLayer";
import { useBinanceData } from "./useBinanceData";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ChartSymbol {
  label: string;
  value: string;
  isLive?: boolean;
}

const popularSymbols: ChartSymbol[] = [
  { label: "BTC/USDT", value: "BTCUSDT", isLive: true },
  { label: "ETH/USDT", value: "ETHUSDT", isLive: true },
  { label: "BNB/USDT", value: "BNBUSDT", isLive: true },
  { label: "SOL/USDT", value: "SOLUSDT", isLive: true },
  { label: "XRP/USDT", value: "XRPUSDT", isLive: true },
  { label: "DOGE/USDT", value: "DOGEUSDT", isLive: true },
  { label: "EUR/USD", value: "EURUSD" },
  { label: "GBP/USD", value: "GBPUSD" },
  { label: "XAU/USD", value: "XAUUSD" },
];

const timeframes = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

export function CustomChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("15");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [activeColor, setActiveColor] = useState("#f59e0b");

  // Get live data from Binance
  const { data, isConnected, isLoading, isLive } = useBinanceData(symbol, interval);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    
    const initChart = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      if (width === 0 || height === 0) {
        requestAnimationFrame(initChart);
        return;
      }

      if (chartRef.current) return;

      const chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#0a0a0a" },
          textColor: "#a1a1aa",
        },
        grid: {
          vertLines: { color: "#27272a" },
          horzLines: { color: "#27272a" },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: "#6366f1",
            width: 1,
            style: 2,
          },
          horzLine: {
            color: "#6366f1",
            width: 1,
            style: 2,
          },
        },
        rightPriceScale: {
          borderColor: "#27272a",
        },
        timeScale: {
          borderColor: "#27272a",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;
      setChartSize({ width, height });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      seriesRef.current = candlestickSeries;
    };

    initChart();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = chartContainerRef.current.clientWidth;
        const newHeight = chartContainerRef.current.clientHeight;
        if (newWidth > 0 && newHeight > 0) {
          chartRef.current.applyOptions({ width: newWidth, height: newHeight });
          setChartSize({ width: newWidth, height: newHeight });
        }
      }
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // Update chart data when data changes
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  const toggleFullscreen = useCallback(() => {
    const container = chartContainerRef.current?.parentElement?.parentElement;
    if (!document.fullscreenElement) {
      container?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleToolChange = (tool: string) => {
    setActiveTool(tool);
    setIsDrawingMode(tool !== "select");
  };

  return (
    <div className="flex flex-col h-full animate-fade-in -mt-4">
      {/* Toolbar */}
      <ChartToolbar
        symbol={symbol}
        onSymbolChange={setSymbol}
        interval={interval}
        onIntervalChange={setInterval}
        activeTool={activeTool}
        onToolChange={handleToolChange}
        symbols={popularSymbols}
        timeframes={timeframes}
        activeColor={activeColor}
        onColorChange={setActiveColor}
      />

      {/* Chart Container */}
      <div 
        className="flex-1 relative rounded-lg overflow-hidden border border-border/50 bg-card mt-2"
        style={{ minHeight: "500px", height: "calc(100vh - 180px)" }}
      >
        {/* Status Badges */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
          {isLive && (
            <Badge 
              variant={isConnected ? "default" : "secondary"} 
              className={`gap-1.5 ${isConnected ? "bg-green-600 hover:bg-green-600" : ""}`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  Connecting...
                </>
              )}
            </Badge>
          )}
          {!isLive && (
            <Badge variant="outline" className="text-muted-foreground">
              Mock Data
            </Badge>
          )}
          {isLoading && (
            <Badge variant="secondary">Loading...</Badge>
          )}
        </div>

        {/* Fullscreen Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 z-20 h-8 w-8 bg-background/80 hover:bg-background"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>

        {/* Lightweight Charts Container */}
        <div
          ref={chartContainerRef}
          className="w-full h-full"
        />

        {/* Drawing Layer (Fabric.js Canvas) */}
        <ChartDrawingLayer
          width={chartSize.width}
          height={chartSize.height}
          isActive={isDrawingMode}
          activeTool={activeTool}
          activeColor={activeColor}
        />
      </div>
    </div>
  );
}
