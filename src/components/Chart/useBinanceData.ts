import { useState, useEffect, useRef, useCallback } from "react";
import { CandlestickData, Time } from "lightweight-charts";

interface BinanceKline {
  t: number; // Kline start time
  T: number; // Kline close time
  s: string; // Symbol
  i: string; // Interval
  o: string; // Open price
  c: string; // Close price
  h: string; // High price
  l: string; // Low price
  v: string; // Base asset volume
  n: number; // Number of trades
  x: boolean; // Is this kline closed?
}

interface BinanceMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: BinanceKline;
}

// Map our symbols to Binance symbols
const symbolMap: Record<string, string> = {
  BTCUSD: "btcusdt",
  BTCUSDT: "btcusdt",
  ETHUSDT: "ethusdt",
  ETHUSD: "ethusdt",
  BNBUSDT: "bnbusdt",
  XRPUSDT: "xrpusdt",
  SOLUSDT: "solusdt",
  ADAUSDT: "adausdt",
  DOGEUSDT: "dogeusdt",
  // Forex pairs - we'll use mock data for these
  EURUSD: null,
  GBPUSD: null,
  USDJPY: null,
  XAUUSD: null,
  // Indices - use mock data
  NAS100: null,
  US30: null,
  SPX: null,
};

// Map interval to Binance interval format
const intervalMap: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "60": "1h",
  "240": "4h",
  "D": "1d",
  "W": "1w",
};

export function useBinanceData(symbol: string, interval: string) {
  const [data, setData] = useState<CandlestickData<Time>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  const binanceSymbol = symbolMap[symbol];
  const binanceInterval = intervalMap[interval] || "15m";

  // Fetch historical data
  const fetchHistoricalData = useCallback(async () => {
    if (!binanceSymbol) {
      // Use mock data for non-crypto symbols
      setData(generateMockData(symbol, interval));
      setIsLoading(false);
      return;
    }

    try {
      console.log("Fetching historical data for:", binanceSymbol.toUpperCase());
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol.toUpperCase()}&interval=${binanceInterval}&limit=500`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const klines = await response.json();
      console.log("Received", klines.length, "candles");

      const formattedData: CandlestickData<Time>[] = klines.map((k: number[]) => ({
        time: (k[0] / 1000) as Time,
        open: parseFloat(k[1] as unknown as string),
        high: parseFloat(k[2] as unknown as string),
        low: parseFloat(k[3] as unknown as string),
        close: parseFloat(k[4] as unknown as string),
      }));

      setData(formattedData);
      setIsLoading(false);
      setConnectionError(null);
    } catch (error) {
      console.error("Error fetching historical data:", error);
      setData(generateMockData(symbol, interval));
      setIsLoading(false);
      setConnectionError("Failed to fetch live data, using mock data");
    }
  }, [binanceSymbol, binanceInterval, symbol, interval]);

  // Connect to WebSocket for real-time updates
  const connect = useCallback(() => {
    if (!binanceSymbol) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close(1000, "Reconnecting");
      wsRef.current = null;
    }

    const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol}@kline_${binanceInterval}`;
    console.log("Connecting to Binance WebSocket:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Binance WebSocket connected successfully");
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: BinanceMessage = JSON.parse(event.data);
          
          if (message.e === "kline") {
            const kline = message.k;
            const newCandle: CandlestickData<Time> = {
              time: (kline.t / 1000) as Time,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
            };

            setData((prevData) => {
              const newData = [...prevData];
              const lastIndex = newData.length - 1;

              // Check if this is an update to the current candle or a new one
              if (lastIndex >= 0 && newData[lastIndex].time === newCandle.time) {
                newData[lastIndex] = newCandle;
              } else if (kline.x) {
                // Kline closed, add new candle
                newData.push(newCandle);
                // Keep only last 500 candles
                if (newData.length > 500) {
                  newData.shift();
                }
              } else if (lastIndex >= 0) {
                // Update current candle
                newData[lastIndex] = newCandle;
              }

              return newData;
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
        setConnectionError("WebSocket connection error");
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        setIsConnected(false);

        // Reconnect after delay if not a normal closure and within retry limit
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, 3000);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError("Connection failed after multiple attempts");
          console.log("Max reconnection attempts reached, using historical data only");
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionError("Failed to establish WebSocket connection");
      setIsConnected(false);
    }
  }, [binanceSymbol, binanceInterval]);

  // Cleanup WebSocket on unmount or when symbol/interval changes
  useEffect(() => {
    setIsLoading(true);
    setIsConnected(false);
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
    
    fetchHistoricalData();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Changing symbol/interval");
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchHistoricalData]);

  // Connect WebSocket after fetching historical data
  useEffect(() => {
    if (!isLoading && binanceSymbol && data.length > 0) {
      // Small delay to ensure historical data is rendered first
      const timer = setTimeout(() => {
        connect();
      }, 500);
      
      return () => clearTimeout(timer);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [isLoading, connect, binanceSymbol, data.length]);

  return { data, isConnected, isLoading, isLive: !!binanceSymbol, connectionError };
}

// Generate mock data for non-crypto symbols
function generateMockData(symbol: string, interval: string): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  
  const basePrices: Record<string, number> = {
    EURUSD: 1.0850,
    GBPUSD: 1.2650,
    USDJPY: 149.50,
    XAUUSD: 2035.00,
    NAS100: 17850,
    US30: 38200,
    SPX: 4780,
  };

  const basePrice = basePrices[symbol] || 100;
  const volatility = basePrice * 0.002;

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

  for (let i = 199; i >= 0; i--) {
    const date = new Date(now.getTime() - i * minutes * 60 * 1000);
    
    const change = (Math.random() - 0.5) * volatility * 2;
    const meanReversion = (basePrice - currentPrice) * 0.01;
    currentPrice += change + meanReversion;

    const open = currentPrice;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    currentPrice = close;

    data.push({
      time: (Math.floor(date.getTime() / 1000)) as Time,
      open: Number(open.toFixed(symbol.includes("JPY") ? 3 : 5)),
      high: Number(high.toFixed(symbol.includes("JPY") ? 3 : 5)),
      low: Number(low.toFixed(symbol.includes("JPY") ? 3 : 5)),
      close: Number(close.toFixed(symbol.includes("JPY") ? 3 : 5)),
    });
  }

  return data;
}
