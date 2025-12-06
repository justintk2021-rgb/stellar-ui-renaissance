import { CandlestickData, Time } from "lightweight-charts";

// Generate realistic-looking mock candlestick data
export function generateMockData(
  symbol: string,
  interval: string,
  count: number = 200
): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  
  // Base prices for different symbols
  const basePrices: Record<string, number> = {
    EURUSD: 1.0850,
    GBPUSD: 1.2650,
    USDJPY: 149.50,
    XAUUSD: 2035.00,
    BTCUSD: 43500,
    ETHUSDT: 2280,
    NAS100: 17850,
    US30: 38200,
    SPX: 4780,
  };

  const basePrice = basePrices[symbol] || 100;
  const volatility = basePrice * 0.002; // 0.2% volatility

  // Time intervals in minutes
  const intervalMinutes: Record<string, number> = {
    "1": 1,
    "5": 5,
    "15": 15,
    "60": 60,
    "240": 240,
    "D": 1440,
    "W": 10080,
  };

  const minutes = intervalMinutes[interval] || 15;
  const now = new Date();
  let currentPrice = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * minutes * 60 * 1000);
    
    // Random walk with mean reversion
    const change = (Math.random() - 0.5) * volatility * 2;
    const meanReversion = (basePrice - currentPrice) * 0.01;
    currentPrice += change + meanReversion;

    // Generate OHLC
    const open = currentPrice;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    currentPrice = close;

    // Format time based on interval
    let time: Time;
    if (interval === "D" || interval === "W") {
      time = date.toISOString().split("T")[0] as Time;
    } else {
      time = Math.floor(date.getTime() / 1000) as Time;
    }

    data.push({
      time,
      open: Number(open.toFixed(symbol.includes("JPY") ? 3 : 5)),
      high: Number(high.toFixed(symbol.includes("JPY") ? 3 : 5)),
      low: Number(low.toFixed(symbol.includes("JPY") ? 3 : 5)),
      close: Number(close.toFixed(symbol.includes("JPY") ? 3 : 5)),
    });
  }

  return data;
}

// Color schemes for different chart elements
export const chartColors = {
  bullish: "#22c55e",
  bearish: "#ef4444",
  line: "#f59e0b",
  trendline: "#22c55e",
  rectangle: "#3b82f6",
  circle: "#8b5cf6",
  text: "#ffffff",
  grid: "hsl(var(--border) / 0.3)",
  crosshair: "hsl(var(--primary) / 0.5)",
};
