import { useEffect, useRef, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Save, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface TradingViewChartProps {
  pair: string;
  direction: 'Long' | 'Short';
  onSaveImage: (imageDataUrl: string) => void;
  existingImage?: string;
}

// Convert common forex/crypto pairs to TradingView format
function formatSymbol(pair: string): string {
  // Remove spaces and special characters
  const cleaned = pair.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Common forex pairs
  const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 
    'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD'];
  
  if (forexPairs.includes(cleaned)) {
    return `FX:${cleaned}`;
  }
  
  // Crypto pairs
  if (cleaned.includes('BTC') || cleaned.includes('ETH') || cleaned.includes('USDT')) {
    return `BINANCE:${cleaned}`;
  }
  
  // Indices
  if (['NAS100', 'US30', 'SPX500', 'US500'].includes(cleaned)) {
    const indexMap: Record<string, string> = {
      'NAS100': 'NASDAQ:NDX',
      'US30': 'DJ:DJI',
      'SPX500': 'SP:SPX',
      'US500': 'SP:SPX',
    };
    return indexMap[cleaned] || `OANDA:${cleaned}`;
  }
  
  // Default to OANDA for forex
  return `OANDA:${cleaned}`;
}

function TradingViewChartComponent({ pair, direction, onSaveImage, existingImage }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const scriptAddedRef = useRef(false);

  useEffect(() => {
    if (!widgetRef.current || scriptAddedRef.current) return;
    
    const symbol = formatSymbol(pair);
    scriptAddedRef.current = true;

    // Clear any existing content
    widgetRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "15",
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
      hotlist: false,
      studies: ["RSI@tv-basicstudies"],
      container_id: `tradingview_${pair.replace(/[^a-zA-Z0-9]/g, '')}`,
    });

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.id = `tradingview_${pair.replace(/[^a-zA-Z0-9]/g, '')}`;
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    widgetRef.current.appendChild(widgetContainer);

    return () => {
      scriptAddedRef.current = false;
    };
  }, [pair]);

  const captureChart = async () => {
    if (!containerRef.current) return;
    
    try {
      toast.loading('Capturing chart...');
      
      // Use html2canvas to capture the widget
      const canvas = await html2canvas(containerRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0a0f',
        scale: 2,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      onSaveImage(dataUrl);
      toast.dismiss();
      toast.success('Chart saved to notes!');
    } catch (error) {
      toast.dismiss();
      toast.error('Could not capture chart. Try using the download button on TradingView.');
    }
  };

  const openInTradingView = () => {
    const symbol = formatSymbol(pair);
    window.open(`https://www.tradingview.com/chart/?symbol=${symbol}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            direction === 'Long' ? "bg-primary/20" : "bg-destructive/20"
          )}>
            {direction === 'Long' ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
          <div>
            <h4 className="font-semibold">{pair}</h4>
            <Badge variant="outline" className={cn(
              "text-[10px]",
              direction === 'Long' ? "border-primary/50 text-primary" : "border-destructive/50 text-destructive"
            )}>
              {direction}
            </Badge>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={openInTradingView}
          className="text-xs"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Open Full Chart
        </Button>
      </div>

      {/* TradingView Widget */}
      <div 
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-border/50 bg-background"
        style={{ height: '400px' }}
      >
        <div ref={widgetRef} style={{ height: '100%', width: '100%' }} />
      </div>

      {/* Instructions */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Use TradingView's built-in tools to draw Entry, Take Profit, and Stop Loss levels. 
          Click the drawing tools on the left sidebar, then save your annotated chart.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
        <Button
          size="sm"
          onClick={captureChart}
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Chart to Notes
        </Button>
      </div>

      {/* Existing saved chart */}
      {existingImage && (
        <div className="space-y-2 pt-4 border-t border-border/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Previously Saved Chart</span>
          <div className="rounded-xl overflow-hidden border border-border/50">
            <img 
              src={existingImage} 
              alt="Saved trade chart" 
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
