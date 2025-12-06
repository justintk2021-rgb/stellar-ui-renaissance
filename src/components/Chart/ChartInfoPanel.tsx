import { TrendingUp, TrendingDown } from "lucide-react";

interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartInfoPanelProps {
  symbol: string;
  data: OHLCData | null;
  connectionStatus: "connecting" | "live" | "offline" | "mock";
}

export function ChartInfoPanel({ symbol, data, connectionStatus }: ChartInfoPanelProps) {
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const priceChange = data ? data.close - data.open : 0;
  const priceChangePercent = data ? ((priceChange / data.open) * 100) : 0;
  const isPositive = priceChange >= 0;

  const statusColors = {
    connecting: "bg-yellow-500",
    live: "bg-green-500",
    offline: "bg-red-500",
    mock: "bg-blue-500",
  };

  const statusLabels = {
    connecting: "Connecting...",
    live: "Live",
    offline: "Offline",
    mock: "Demo Data",
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Symbol & Status */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground">{symbol}</span>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${statusColors[connectionStatus]} animate-pulse`} />
          <span className="text-xs text-muted-foreground">{statusLabels[connectionStatus]}</span>
        </div>
      </div>

      {data && (
        <>
          {/* OHLC Values */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">O</span>
              <span className="text-foreground font-medium">{formatPrice(data.open)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">H</span>
              <span className="text-green-500 font-medium">{formatPrice(data.high)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">L</span>
              <span className="text-red-500 font-medium">{formatPrice(data.low)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">C</span>
              <span className={`font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {formatPrice(data.close)}
              </span>
            </div>
          </div>

          {/* Change */}
          <div className={`flex items-center gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="text-xs font-medium">
              {isPositive ? "+" : ""}{formatPrice(priceChange)} ({isPositive ? "+" : ""}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
