import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Maximize2, BarChart3 } from "lucide-react";

interface ChartPageProps {
  defaultSymbol?: string;
}

const popularSymbols = [
  { label: "EUR/USD", value: "FX:EURUSD" },
  { label: "GBP/USD", value: "FX:GBPUSD" },
  { label: "USD/JPY", value: "FX:USDJPY" },
  { label: "XAU/USD", value: "FX:XAUUSD" },
  { label: "BTC/USD", value: "BINANCE:BTCUSDT" },
  { label: "ETH/USD", value: "BINANCE:ETHUSDT" },
  { label: "NAS100", value: "PEPPERSTONE:NAS100" },
  { label: "US30", value: "PEPPERSTONE:US30" },
  { label: "S&P 500", value: "SP:SPX" },
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

export function ChartPage({ defaultSymbol = "FX:EURUSD" }: ChartPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [searchInput, setSearchInput] = useState("");
  const [interval, setInterval] = useState("15");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const widgetIdRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';
    widgetIdRef.current += 1;
    const currentId = widgetIdRef.current;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: true,
      studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
      save_image: true,
      hide_volume: false,
      container_id: `tv_chart_${currentId}`,
    });

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.id = `tv_chart_${currentId}`;
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      // Format symbol for TradingView
      const formatted = searchInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setSymbol(formatted);
      setSearchInput("");
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="animate-fade-in h-full flex flex-col -mt-4">
      {/* Compact Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Symbol Search */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search symbol..."
              className="pl-8 h-8 text-sm bg-background/50"
            />
          </div>
          <Button size="sm" onClick={handleSearch} variant="secondary" className="h-8 px-3">
            Go
          </Button>
        </div>

        {/* Quick Symbols */}
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-[120px] h-8 bg-background/50 text-sm">
            <SelectValue placeholder="Symbol" />
          </SelectTrigger>
          <SelectContent>
            {popularSymbols.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Timeframe */}
        <div className="flex items-center gap-0.5 bg-background/50 rounded-md p-0.5 border border-border/50">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval(tf.value)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                interval === tf.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open('https://www.tradingview.com/accounts/signin/', '_blank')}
            className="text-xs h-8 gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            TradingView Login
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={toggleFullscreen}
            className="h-8 w-8"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Chart Container - Maximum Height */}
      <div 
        className="flex-1 rounded-lg overflow-hidden border border-border/50 bg-background"
        style={{ height: 'calc(100vh - 140px)', minHeight: '500px' }}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
