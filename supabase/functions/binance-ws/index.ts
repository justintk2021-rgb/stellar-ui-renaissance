import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol') || 'btcusdt';
  const interval = url.searchParams.get('interval') || '15m';

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
  
  let binanceSocket: WebSocket | null = null;
  let isClientConnected = true;

  const connectToBinance = () => {
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
    console.log(`Connecting to Binance WebSocket: ${wsUrl}`);
    
    binanceSocket = new WebSocket(wsUrl);

    binanceSocket.onopen = () => {
      console.log('Connected to Binance WebSocket');
      if (isClientConnected) {
        clientSocket.send(JSON.stringify({ type: 'connected', symbol, interval }));
      }
    };

    binanceSocket.onmessage = (event) => {
      if (isClientConnected && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    binanceSocket.onerror = (error) => {
      console.error('Binance WebSocket error:', error);
      if (isClientConnected && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'error', message: 'Binance connection error' }));
      }
    };

    binanceSocket.onclose = (event) => {
      console.log('Binance WebSocket closed:', event.code, event.reason);
      if (isClientConnected && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'disconnected' }));
      }
    };
  };

  clientSocket.onopen = () => {
    console.log('Client connected');
    connectToBinance();
  };

  clientSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Handle subscription changes
      if (message.type === 'subscribe') {
        console.log('Resubscribing to:', message.symbol, message.interval);
        
        // Close existing Binance connection
        if (binanceSocket && binanceSocket.readyState === WebSocket.OPEN) {
          binanceSocket.close(1000, 'Changing subscription');
        }
        
        // Reconnect with new parameters
        const newWsUrl = `wss://stream.binance.com:9443/ws/${message.symbol.toLowerCase()}@kline_${message.interval}`;
        console.log(`Reconnecting to: ${newWsUrl}`);
        
        binanceSocket = new WebSocket(newWsUrl);
        
        binanceSocket.onopen = () => {
          console.log('Reconnected to Binance');
          if (isClientConnected) {
            clientSocket.send(JSON.stringify({ type: 'connected', symbol: message.symbol, interval: message.interval }));
          }
        };
        
        binanceSocket.onmessage = (evt) => {
          if (isClientConnected && clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(evt.data);
          }
        };
        
        binanceSocket.onerror = (err) => {
          console.error('Binance error:', err);
        };
        
        binanceSocket.onclose = () => {
          console.log('Binance closed');
        };
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  };

  clientSocket.onclose = () => {
    console.log('Client disconnected');
    isClientConnected = false;
    if (binanceSocket && binanceSocket.readyState === WebSocket.OPEN) {
      binanceSocket.close(1000, 'Client disconnected');
    }
  };

  clientSocket.onerror = (error) => {
    console.error('Client WebSocket error:', error);
    isClientConnected = false;
  };

  return response;
});