import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sun, Moon, Calculator, ChevronLeft, ChevronRight } from "lucide-react";
import { LotSizeCalculator } from "@/components/Calculator/LotSizeCalculator";

type ChartTheme = "light" | "dark";

export function LightweightChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState(() => {
    return localStorage.getItem("chart-symbol") || "BTCUSD";
  });
  const [searchValue, setSearchValue] = useState("");
  const [theme, setTheme] = useState<ChartTheme>(() => {
    const stored = localStorage.getItem("theme");
    return stored === "light" ? "light" : "dark";
  });
  const [showCalculator, setShowCalculator] = useState(() => {
    return localStorage.getItem("chart-show-calculator") === "true";
  });

  // Save calculator visibility to localStorage
  useEffect(() => {
    localStorage.setItem("chart-show-calculator", String(showCalculator));
  }, [showCalculator]);

  // Save symbol to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("chart-symbol", symbol);
  }, [symbol]);

  // Load TradingView widget
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "15",
      timezone: "Etc/UTC",
      theme: theme,
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      details: true,
      withdateranges: true,
      studies: [],
      support_host: "https://www.tradingview.com",
    });

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    containerRef.current.appendChild(widgetContainer);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, theme]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      setSymbol(searchValue.trim().toUpperCase());
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="flex gap-4 animate-fade-in" style={{ height: "calc(100vh - 140px)" }}>
      {/* Main Chart Section */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header - Centered Search */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol (e.g., BTCUSD)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-10 bg-background/50 border-border/50 text-center"
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            <span className="text-foreground font-medium">{symbol}</span>
          </span>
          <Button
            variant={showCalculator ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setShowCalculator(!showCalculator)}
            title={showCalculator ? "Hide calculator" : "Show calculator"}
          >
            <Calculator className="w-4 h-4" />
          </Button>
        </div>

        {/* TradingView Widget */}
        <div
          ref={containerRef}
          className="tradingview-widget-container flex-1 rounded-lg overflow-hidden border border-border/50"
          style={{ minHeight: "400px" }}
        />
      </div>

      {/* Calculator Panel */}
      {showCalculator && (
        <div className="w-[420px] flex-shrink-0 overflow-y-auto border-l border-border/50 pl-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Lot Size Calculator</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowCalculator(false)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <LotSizeCalculator compact />
        </div>
      )}
    </div>
  );
}
