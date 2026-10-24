import { memo, useEffect, useId, useRef } from "react";
import { TRADINGVIEW_WIDGET_SCRIPT } from "@/lib/chartTrading/tradingViewSymbols";
import type { AppTheme } from "@/lib/theme";

interface TradingViewAdvancedChartProps {
  symbol: string;
  interval: string;
  theme: AppTheme;
  timezone: string;
}

function backgroundForTheme(theme: AppTheme): string {
  return theme === "light" ? "rgba(255, 255, 255, 0)" : "rgba(10, 12, 16, 0)";
}

function TradingViewAdvancedChartComponent({
  symbol,
  interval,
  theme,
  timezone,
}: TradingViewAdvancedChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceId = useId().replace(/:/g, "");

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !symbol) return;

    host.replaceChildren();

    const container = document.createElement("div");
    container.className = "tradingview-widget-container h-full w-full";
    container.style.height = "100%";
    container.style.width = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.id = `tradingview_${instanceId}`;
    widget.style.height = "calc(100% - 32px)";
    widget.style.width = "100%";

    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright";
    const credit = document.createElement("a");
    credit.href = `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(":", "-"))}/?utm_source=nsync-journal&utm_medium=widget&utm_campaign=advanced-chart`;
    credit.rel = "noopener nofollow";
    credit.target = "_blank";
    const label = document.createElement("span");
    label.className = "blue-text";
    label.textContent = "Track all markets on TradingView";
    credit.append(label);
    copyright.append(credit);

    const script = document.createElement("script");
    script.src = TRADINGVIEW_WIDGET_SCRIPT;
    script.type = "text/javascript";
    script.async = true;
    script.dataset.tvInstance = instanceId;
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone,
      theme,
      style: "1",
      locale: "en",
      backgroundColor: backgroundForTheme(theme),
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      hide_volume: false,
      withdateranges: true,
      details: false,
      hotlist: false,
      support_host: "https://www.tradingview.com",
    });

    container.append(widget, copyright, script);
    host.append(container);

    return () => {
      host.replaceChildren();
    };
  }, [instanceId, interval, symbol, theme, timezone]);

  return (
    <div
      ref={hostRef}
      className="tv-advanced-chart h-full min-h-[20rem] w-full"
      data-tv-symbol={symbol}
      data-tv-interval={interval}
    />
  );
}

export const TradingViewAdvancedChart = memo(TradingViewAdvancedChartComponent);
