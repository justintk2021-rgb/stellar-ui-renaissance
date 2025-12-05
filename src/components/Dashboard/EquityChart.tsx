import { useEffect, useRef, useState } from "react";
import { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

interface EquityChartProps {
  trades: Trade[];
  startBalance: number;
  onSetBalance: () => void;
}

export function EquityChart({ trades, startBalance, onSetBalance }: EquityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const sortedTrades = [...trades].sort((a, b) => {
    if (a.date === b.date) return parseInt(a.id) - parseInt(b.id);
    return a.date < b.date ? -1 : 1;
  });

  const series: number[] = [startBalance];
  let equity = startBalance;
  sortedTrades.forEach((trade) => {
    equity += trade.result || 0;
    series.push(equity);
  });

  if (series.length < 2) series.push(equity);

  const currentBalance = series[series.length - 1];
  const change = currentBalance - startBalance;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const values = series;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 50;
      max += 50;
    }

    const padding = { left: 20, right: 12, top: 20, bottom: 20 };
    const chartW = dimensions.width - padding.left - padding.right;
    const chartH = dimensions.height - padding.top - padding.bottom;

    const yFor = (v: number) => padding.top + ((max - v) * chartH) / (max - min);
    const xFor = (i: number) => {
      if (series.length <= 1) return padding.left + chartW / 2;
      return padding.left + (chartW / (series.length - 1)) * i;
    };

    // Grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yFor(min));
    ctx.lineTo(dimensions.width - padding.right, yFor(min));
    ctx.moveTo(padding.left, yFor(max));
    ctx.lineTo(dimensions.width - padding.right, yFor(max));
    ctx.stroke();
    ctx.setLineDash([]);

    // Equity line
    ctx.beginPath();
    series.forEach((val, i) => {
      const x = xFor(i);
      const y = yFor(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const gradient = ctx.createLinearGradient(padding.left, 0, dimensions.width - padding.right, 0);
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.6)");
    gradient.addColorStop(1, "rgba(52, 211, 153, 0.9)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fill under
    ctx.beginPath();
    series.forEach((val, i) => {
      const x = xFor(i);
      const y = yFor(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xFor(series.length - 1), dimensions.height - padding.bottom);
    ctx.lineTo(xFor(0), dimensions.height - padding.bottom);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, padding.top, 0, dimensions.height - padding.bottom);
    fillGrad.addColorStop(0, "rgba(52, 211, 153, 0.2)");
    fillGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Candles
    for (let i = 1; i < series.length; i++) {
      const open = series[i - 1];
      const close = series[i];
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      const x = xFor(i);
      const yHigh = yFor(high);
      const yLow = yFor(low);
      const yOpen = yFor(open);
      const yClose = yFor(close);
      const isUp = close >= open;

      ctx.strokeStyle = isUp ? "#4ade80" : "#fb7185";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      const bodyWidth = 6;
      const topY = Math.min(yOpen, yClose);
      const bodyH = Math.max(Math.abs(yClose - yOpen), 2);
      ctx.fillStyle = isUp ? "rgba(52, 211, 153, 0.9)" : "rgba(251, 113, 133, 0.9)";
      ctx.fillRect(x - bodyWidth / 2, topY, bodyWidth, bodyH);
    }
  }, [series, dimensions]);

  return (
    <div className="glass rounded-2xl p-5 border border-border/40 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold">Account Growth</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Equity curve based on your trade P/L
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</div>
              <div className="text-sm font-bold font-mono">${startBalance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
              <div className="text-sm font-bold font-mono">${currentBalance.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Change</div>
              <div className={`text-sm font-bold font-mono ${change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSetBalance}
            className="text-xs border-border/50 hover:border-primary/50 hover:bg-primary/10"
          >
            <Settings2 className="w-3 h-3 mr-1" />
            Set Balance
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-56 rounded-xl overflow-hidden border border-secondary/30 bg-gradient-to-br from-card via-card to-muted/20"
        style={{
          background: `
            radial-gradient(circle at 0% 0%, rgba(52, 211, 153, 0.15), transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.15), transparent 50%),
            hsl(222 47% 6%)
          `,
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
