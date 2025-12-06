import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function CustomChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState("BTCUSD");
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    const container = containerRef.current;
    container.innerHTML = "";

    // Create widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";
    
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    widgetContainer.appendChild(widgetDiv);

    // Create TradingView widget script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: true,
      hide_volume: false,
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(39, 39, 42, 0.5)",
      withdateranges: true,
      details: true,
    });

    widgetContainer.appendChild(script);
    container.appendChild(widgetContainer);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      setSymbol(searchValue.trim().toUpperCase());
    }
  };

  return (
    <div className="flex flex-col animate-fade-in -mt-2" style={{ height: "calc(100vh - 180px)" }}>
      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search symbol (e.g., BTCUSD, AAPL, EURUSD)"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearch}
            className="pl-10 bg-background/50 border-border/50"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          Current: <span className="text-foreground font-medium">{symbol}</span>
        </span>
      </div>

      {/* Chart Container */}
      <div 
        className="flex-1 relative rounded-lg overflow-hidden border border-border/50"
        style={{ minHeight: "600px" }}
      >
        <div 
          ref={containerRef}
          className="w-full h-full"
          style={{ height: "100%", width: "100%" }}
        />
      </div>
    </div>
  );
}