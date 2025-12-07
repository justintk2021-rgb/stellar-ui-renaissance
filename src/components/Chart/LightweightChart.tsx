import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sun, Moon, Calculator, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { LotSizeCalculator } from "@/components/Calculator/LotSizeCalculator";
import { cn } from "@/lib/utils";

type ChartTheme = "light" | "dark";

export function LightweightChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState(() => {
    return localStorage.getItem("chart-symbol") || "BTCUSD";
  });
  const [searchValue, setSearchValue] = useState("");
  const [chartTheme, setChartTheme] = useState<ChartTheme>(() => {
    const stored = localStorage.getItem("chart-theme");
    return stored === "light" ? "light" : "dark";
  });
  const [showCalculator, setShowCalculator] = useState(() => {
    return localStorage.getItem("chart-show-calculator") === "true";
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Save calculator visibility to localStorage
  useEffect(() => {
    localStorage.setItem("chart-show-calculator", String(showCalculator));
  }, [showCalculator]);

  // Save chart theme to localStorage
  useEffect(() => {
    localStorage.setItem("chart-theme", chartTheme);
  }, [chartTheme]);

  // Save symbol to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("chart-symbol", symbol);
  }, [symbol]);

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

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
      theme: chartTheme,
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
  }, [symbol, chartTheme]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      setSymbol(searchValue.trim().toUpperCase());
    }
  };

  const toggleChartTheme = () => {
    setChartTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div 
      className={cn(
        "flex gap-4 animate-fade-in transition-all duration-300",
        isFullscreen 
          ? "fixed inset-0 z-[100] bg-background p-4" 
          : ""
      )}
      style={{ height: isFullscreen ? "100vh" : "calc(100vh - 140px)" }}
    >
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
          <Button
            variant={isFullscreen ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>

        {/* TradingView Widget */}
        <div className="relative flex-1">
          <div
            ref={containerRef}
            className="tradingview-widget-container h-full rounded-lg overflow-hidden border border-border/50"
            style={{ minHeight: "400px" }}
          />
          
          {/* Bottom Center Theme Toggle */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleChartTheme}
              className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg"
              title={chartTheme === "dark" ? "Switch to light chart" : "Switch to dark chart"}
            >
              {chartTheme === "dark" ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="text-xs">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="text-xs">Dark</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Calculator Panel - hidden in fullscreen */}
      {showCalculator && !isFullscreen && (
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
