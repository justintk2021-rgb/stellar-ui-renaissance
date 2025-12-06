import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sun, Moon } from "lucide-react";

type ChartTheme = "light" | "dark";

const themes = {
  dark: {
    background: "#0a0a0a",
    textColor: "#d1d5db",
    gridColor: "rgba(42, 46, 57, 0.5)",
    borderColor: "#2a2e39",
  },
  light: {
    background: "#ffffff",
    textColor: "#131722",
    gridColor: "rgba(42, 46, 57, 0.1)",
    borderColor: "#e0e3eb",
  },
};

// Generate sample data
function generateData(symbol: string): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  const now = Date.now();
  let price = symbol.includes("BTC") ? 95000 : symbol.includes("ETH") ? 3500 : 150;

  for (let i = 300; i >= 0; i--) {
    const time = Math.floor((now - i * 15 * 60 * 1000) / 1000) as Time;
    const volatility = price * 0.003;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [symbol, setSymbol] = useState("BTCUSD");
  const [searchValue, setSearchValue] = useState("");
  const [theme, setTheme] = useState<ChartTheme>(() => {
    const stored = localStorage.getItem("theme");
    return stored === "light" ? "light" : "dark";
  });

  const colors = themes[theme];

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    seriesRef.current = series;
    series.setData(generateData(symbol));
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [theme]);

  // Update data when symbol changes
  useEffect(() => {
    if (seriesRef.current && chartRef.current) {
      seriesRef.current.setData(generateData(symbol));
      chartRef.current.timeScale().fitContent();
    }
  }, [symbol]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      setSymbol(searchValue.trim().toUpperCase());
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="flex flex-col animate-fade-in -mt-2" style={{ height: "calc(100vh - 180px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search symbol (e.g., BTCUSD)"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearch}
            className="pl-10 bg-background/50 border-border/50"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{symbol}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="flex-1 rounded-lg overflow-hidden border border-border/50"
        style={{ minHeight: "600px" }}
      />
    </div>
  );
}
