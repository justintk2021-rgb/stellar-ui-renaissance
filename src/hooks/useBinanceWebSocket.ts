import { useEffect, useRef, useState, useCallback } from "react";
import { CandlestickData, Time } from "lightweight-charts";

export type ConnectionStatus = "connecting" | "live" | "offline" | "mock";

interface BinanceKline {
  t: number; // Open time
  o: string; // Open
  h: string; // High
  l: string; // Low
  c: string; // Close
  v: string; // Volume
  x: boolean; // Is closed
}

interface BinanceMessage {
  k: BinanceKline;
}

// Map common symbols to Binance format
function toBinanceSymbol(symbol: string): string | null {
  const mapped: Record<string, string> = {
    BTCUSD: "btcusdt",
    ETHUSD: "ethusdt",
    BTCUSDT: "btcusdt",
    ETHUSDT: "ethusdt",
    BNBUSD: "bnbusdt",
    BNBUSDT: "bnbusdt",
    SOLUSD: "solusdt",
    SOLUSDT: "solusdt",
    XRPUSD: "xrpusdt",
    XRPUSDT: "xrpusdt",
    DOGEUSD: "dogeusdt",
    DOGEUSDT: "dogeusdt",
    ADAUSD: "adausdt",
    ADAUSDT: "adausdt",
  };
  return mapped[symbol.toUpperCase()] || null;
}

// Generate mock historical data
function generateMockData(symbol: string, interval: string): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  const now = Date.now();
  
  const intervalMs: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };

  const ms = intervalMs[interval] || 15 * 60 * 1000;
  let price = symbol.includes("BTC") ? 95000 : symbol.includes("ETH") ? 3500 : 100;

  for (let i = 500; i >= 0; i--) {
    const time = Math.floor((now - i * ms) / 1000) as Time;
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

export function useBinanceWebSocket(symbol: string, interval: string) {
  const [data, setData] = useState<CandlestickData<Time>[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [currentCandle, setCurrentCandle] = useState<CandlestickData<Time> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const binanceSymbol = toBinanceSymbol(symbol);
  const binanceInterval = interval === "D" ? "1d" : interval === "240" ? "4h" : interval === "60" ? "1h" : `${interval}m`;

  // Fetch historical data
  const fetchHistoricalData = useCallback(async () => {
    if (!binanceSymbol) {
      setData(generateMockData(symbol, binanceInterval));
      setStatus("mock");
      return;
    }

    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol.toUpperCase()}&interval=${binanceInterval}&limit=500`
      );
      const klines = await response.json();

      const historicalData: CandlestickData<Time>[] = klines.map((k: any[]) => ({
        time: Math.floor(k[0] / 1000) as Time,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));

      setData(historicalData);
      if (historicalData.length > 0) {
        setCurrentCandle(historicalData[historicalData.length - 1]);
      }
    } catch (error) {
      console.error("Failed to fetch historical data:", error);
      setData(generateMockData(symbol, binanceInterval));
      setStatus("mock");
    }
  }, [binanceSymbol, binanceInterval, symbol]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!binanceSymbol) {
      setStatus("mock");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    setStatus("connecting");

    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_${binanceInterval}`
    );

    ws.onopen = () => {
      setStatus("live");
      retryCountRef.current = 0;
    };

    ws.onmessage = (event) => {
      const message: BinanceMessage = JSON.parse(event.data);
      const kline = message.k;

      const candle: CandlestickData<Time> = {
        time: Math.floor(kline.t / 1000) as Time,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
      };

      setCurrentCandle(candle);

      if (kline.x) {
        // Candle closed, add to historical data
        setData((prev) => {
          const newData = [...prev];
          const lastIndex = newData.findIndex((d) => d.time === candle.time);
          if (lastIndex >= 0) {
            newData[lastIndex] = candle;
          } else {
            newData.push(candle);
          }
          return newData;
        });
      } else {
        // Update current candle
        setData((prev) => {
          const newData = [...prev];
          const lastIndex = newData.length - 1;
          if (lastIndex >= 0 && newData[lastIndex].time === candle.time) {
            newData[lastIndex] = candle;
          } else if (lastIndex < 0 || (candle.time as number) > (newData[lastIndex].time as number)) {
            newData.push(candle);
          }
          return newData;
        });
      }
    };

    ws.onerror = () => {
      setStatus("offline");
    };

    ws.onclose = () => {
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 2000 * retryCountRef.current);
      } else {
        setStatus("offline");
      }
    };

    wsRef.current = ws;
  }, [binanceSymbol, binanceInterval]);

  useEffect(() => {
    fetchHistoricalData();
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchHistoricalData, connect]);

  return { data, status, currentCandle };
}
