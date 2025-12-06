import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Symbol mapping
const symbolMap: Record<string, { fsym: string; tsym: string }> = {
  BTCUSDT: { fsym: "BTC", tsym: "USDT" },
  ETHUSDT: { fsym: "ETH", tsym: "USDT" },
  BNBUSDT: { fsym: "BNB", tsym: "USDT" },
  SOLUSDT: { fsym: "SOL", tsym: "USDT" },
  XRPUSDT: { fsym: "XRP", tsym: "USDT" },
  ADAUSDT: { fsym: "ADA", tsym: "USDT" },
  DOGEUSDT: { fsym: "DOGE", tsym: "USDT" },
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Handle CORS preflight for non-WebSocket requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
  const interval = url.searchParams.get('interval') || '15m';

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
  
  let currentSymbol = symbol;
  let isClientConnected = true;
  let pollInterval: number | null = null;
  let lastPrice: number | null = null;

  // Function to fetch current price from CryptoCompare
  const fetchCurrentPrice = async (sym: string) => {
    const symbolInfo = symbolMap[sym];
    if (!symbolInfo) return null;

    try {
      const apiUrl = `https://min-api.cryptocompare.com/data/price?fsym=${symbolInfo.fsym}&tsyms=${symbolInfo.tsym}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      return data[symbolInfo.tsym] || null;
    } catch (error) {
      console.error('Error fetching price:', error);
      return null;
    }
  };

  // Function to fetch latest candle
  const fetchLatestCandle = async (sym: string, int: string) => {
    const symbolInfo = symbolMap[sym];
    if (!symbolInfo) return null;

    try {
      const endpoint = int.includes('m') ? 'histominute' : int.includes('h') ? 'histohour' : 'histoday';
      const apiUrl = `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${symbolInfo.fsym}&tsym=${symbolInfo.tsym}&limit=1`;
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (result.Data?.Data?.[0]) {
        const candle = result.Data.Data[0];
        return {
          e: "kline",
          E: Date.now(),
          s: sym,
          k: {
            t: candle.time * 1000,
            T: (candle.time + 60) * 1000,
            s: sym,
            i: int,
            o: String(candle.open),
            c: String(candle.close),
            h: String(candle.high),
            l: String(candle.low),
            v: String(candle.volumefrom || 0),
            n: 0,
            x: false,
          }
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching candle:', error);
      return null;
    }
  };

  // Start polling for price updates
  const startPolling = (sym: string, int: string) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    // Poll every 5 seconds for real-time updates
    pollInterval = setInterval(async () => {
      if (!isClientConnected) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }

      const candle = await fetchLatestCandle(sym, int);
      if (candle && clientSocket.readyState === WebSocket.OPEN) {
        // Update with current price
        const currentPrice = await fetchCurrentPrice(sym);
        if (currentPrice && candle.k) {
          candle.k.c = String(currentPrice);
          // Update high/low if needed
          if (currentPrice > parseFloat(candle.k.h)) {
            candle.k.h = String(currentPrice);
          }
          if (currentPrice < parseFloat(candle.k.l)) {
            candle.k.l = String(currentPrice);
          }
        }
        clientSocket.send(JSON.stringify(candle));
      }
    }, 5000);

    console.log(`Started polling for ${sym} at ${int} interval`);
  };

  clientSocket.onopen = () => {
    console.log('Client connected');
    clientSocket.send(JSON.stringify({ type: 'connected', symbol: currentSymbol, interval }));
    startPolling(currentSymbol, interval);
  };

  clientSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'subscribe') {
        console.log('Resubscribing to:', message.symbol, message.interval);
        currentSymbol = message.symbol;
        startPolling(message.symbol, message.interval);
        clientSocket.send(JSON.stringify({ type: 'connected', symbol: message.symbol, interval: message.interval }));
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  };

  clientSocket.onclose = () => {
    console.log('Client disconnected');
    isClientConnected = false;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  };

  clientSocket.onerror = (error) => {
    console.error('Client WebSocket error:', error);
    isClientConnected = false;
  };

  return response;
});