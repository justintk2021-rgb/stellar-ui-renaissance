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
    containerRef.current.innerHTML = "";

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
      save_image: true,
      hide_volume: false,
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(39, 39, 42, 0.5)",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchValue.trim()) {
      setSymbol(searchValue.trim().toUpperCase());
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in -mt-4">
      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-3">
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

      {/* TradingView Chart Container */}
      <div 
        className="flex-1 relative rounded-lg overflow-hidden border border-border/50 bg-card"
        style={{ minHeight: "500px", height: "calc(100vh - 220px)" }}
      >
        <div 
          ref={containerRef}
          className="tradingview-widget-container w-full h-full"
          style={{ height: "100%", width: "100%" }}
        />
      </div>

      {/* Attribution */}
      <p className="text-xs text-muted-foreground/60 mt-2 text-center">
        Chart powered by TradingView
      </p>
    </div>
  );
}