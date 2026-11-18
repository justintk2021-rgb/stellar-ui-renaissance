import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventHandler,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import { computeEma, computeRsi } from "@/lib/chartTrading/indicators";
import {
  getSymbolSpec,
  type Candle,
  type Position,
} from "@/lib/chartTrading/types";
import { asUtc, buildChartOptions, getChartPalette } from "./chartTheme";

export interface ChartApi {
  priceToY: (price: number) => number | null;
  yToPrice: (y: number) => number | null;
  timeToX: (time: number) => number | null;
  xToTime: (x: number) => number | null;
  subscribeViewChange: (cb: () => void) => () => void;
  updateBar: (bar: Candle) => void;
  getChart: () => IChartApi | null;
  getCandleSeries: () => ISeriesApi<"Candlestick"> | null;
  subscribeCrosshairMove: (handler: MouseEventHandler<Time>) => () => void;
  subscribeClick: (handler: MouseEventHandler<Time>) => () => void;
}

function toUtcTimestamp(time: number): UTCTimestamp {
  return (time > 1e12 ? Math.floor(time / 1000) : Math.floor(time)) as UTCTimestamp;
}

export interface CandleChartProps {
  candles: Candle[];
  symbol: string;
  positions: Position[];
  showEma20: boolean;
  showEma50: boolean;
  showRsi: boolean;
  draggingId: string | null;
  onNeedMoreHistory?: () => void;
  onReady?: () => void;
}

export const CandleChart = forwardRef<ChartApi, CandleChartProps>(function CandleChart(
  { candles, symbol, positions, showEma20, showEma50, showRsi, draggingId, onNeedMoreHistory, onReady },
  ref,
) {
  const theme = useDocumentTheme();
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const fitOnceRef = useRef(true);
  const fittedCountRef = useRef(0);
  const dataKeyRef = useRef<{ symbol: string; len: number; lastTime: number | null; firstTime: number | null }>({
    symbol: "",
    len: 0,
    lastTime: null,
    firstTime: null,
  });

  useImperativeHandle(ref, () => ({
    priceToY: (price) => candleSeriesRef.current?.priceToCoordinate(price) ?? null,
    yToPrice: (y) => candleSeriesRef.current?.coordinateToPrice(y) ?? null,
    timeToX: (time) => chartRef.current?.timeScale().timeToCoordinate(asUtc(toUtcTimestamp(time))) ?? null,
    xToTime: (x) => {
      const time = chartRef.current?.timeScale().coordinateToTime(x);
      return typeof time === "number" ? time : null;
    },
    subscribeViewChange: (cb) => {
      const chart = chartRef.current;
      if (!chart) return () => undefined;
      chart.timeScale().subscribeVisibleLogicalRangeChange(cb);
      chart.timeScale().subscribeVisibleTimeRangeChange(cb);
      window.addEventListener("resize", cb);
      return () => {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(cb);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(cb);
        window.removeEventListener("resize", cb);
      };
    },
    updateBar: (bar) => {
      const candleSeries = candleSeriesRef.current;
      const volumeSeries = volumeSeriesRef.current;
      if (!candleSeries || !volumeSeries) return;
      const palette = getChartPalette(theme);
      const time = toUtcTimestamp(bar.time);
      candleSeries.update({
        time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      });
      volumeSeries.update({
        time,
        value: bar.volume,
        color: bar.close >= bar.open ? palette.volumeUp : palette.volumeDown,
      });
    },
    getChart: () => chartRef.current,
    getCandleSeries: () => candleSeriesRef.current,
    subscribeCrosshairMove: (handler) => {
      const chart = chartRef.current;
      if (!chart) return () => undefined;
      chart.subscribeCrosshairMove(handler);
      return () => chart.unsubscribeCrosshairMove(handler);
    },
    subscribeClick: (handler) => {
      const chart = chartRef.current;
      if (!chart) return () => undefined;
      chart.subscribeClick(handler);
      return () => chart.unsubscribeClick(handler);
    },
  }), [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const palette = getChartPalette(theme);
    const chart = createChart(host, buildChartOptions(palette));
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderVisible: true,
      borderUpColor: palette.up,
      borderDownColor: "#9ca3af",
      wickUpColor: palette.up,
      wickDownColor: "#9ca3af",
      lastValueVisible: true,
      priceLineVisible: true,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    fitOnceRef.current = true;
    fittedCountRef.current = 0;
    dataKeyRef.current = { symbol: "", len: 0, lastTime: null, firstTime: null };
    onReadyRef.current?.();

    return () => {
      linesRef.current = [];
      ema20Ref.current = null;
      ema50Ref.current = null;
      rsiRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chart.remove();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    const palette = getChartPalette(theme);
    const spec = getSymbolSpec(symbol);
    const last = candles[candles.length - 1];
    const lastUp = last ? last.close >= last.open : true;
    candleSeries.applyOptions({
      priceFormat: { type: "price", precision: spec.precision, minMove: spec.minMove },
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: "#9ca3af",
      wickUpColor: palette.up,
      wickDownColor: "#9ca3af",
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: lastUp ? palette.up : "#000000",
    });

    const prev = dataKeyRef.current;
    const firstTime = candles[0]?.time ?? null;
    const prepended =
      prev.symbol === symbol &&
      firstTime != null &&
      prev.firstTime != null &&
      firstTime < prev.firstTime &&
      candles.length > prev.len;
    const added = prepended ? candles.length - prev.len : 0;
    const savedRange = prepended ? chart.timeScale().getVisibleLogicalRange() : null;

    candleSeries.setData(
      candles.map((c) => ({
        time: toUtcTimestamp(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: toUtcTimestamp(c.time),
        value: c.volume,
        color: c.close >= c.open ? palette.volumeUp : palette.volumeDown,
      })),
    );

    if (showEma20) {
      if (!ema20Ref.current) {
        ema20Ref.current = chart.addSeries(LineSeries, {
          color: palette.ema20,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      ema20Ref.current.setData(
        computeEma(candles, 20).map((p) => ({ time: toUtcTimestamp(p.time), value: p.value })),
      );
    } else if (ema20Ref.current) {
      chart.removeSeries(ema20Ref.current);
      ema20Ref.current = null;
    }

    if (showEma50) {
      if (!ema50Ref.current) {
        ema50Ref.current = chart.addSeries(LineSeries, {
          color: palette.ema50,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      ema50Ref.current.setData(
        computeEma(candles, 50).map((p) => ({ time: toUtcTimestamp(p.time), value: p.value })),
      );
    } else if (ema50Ref.current) {
      chart.removeSeries(ema50Ref.current);
      ema50Ref.current = null;
    }

    if (showRsi) {
      if (!rsiRef.current) {
        rsiRef.current = chart.addSeries(
          LineSeries,
          {
            color: palette.rsi,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: { type: "price", precision: 1, minMove: 0.1 },
          },
          1,
        );
        rsiRef.current.priceScale().applyOptions({
          scaleMargins: { top: 0.12, bottom: 0.12 },
        });
      }
      rsiRef.current.setData(
        computeRsi(candles, 14).map((p) => ({ time: toUtcTimestamp(p.time), value: p.value })),
      );
    } else if (rsiRef.current) {
      chart.removeSeries(rsiRef.current);
      rsiRef.current = null;
      if (chart.panes().length > 1) {
        chart.removePane(1);
      }
    }

    dataKeyRef.current = {
      symbol,
      len: candles.length,
      lastTime: last?.time ?? null,
      firstTime,
    };

    if (!candles.length) {
      fitOnceRef.current = true;
      fittedCountRef.current = 0;
      return;
    }

    if (prepended && savedRange) {
      chart.timeScale().setVisibleLogicalRange({
        from: savedRange.from + added,
        to: savedRange.to + added,
      });
      return;
    }

    const shouldFit =
      fitOnceRef.current || candles.length >= Math.max(fittedCountRef.current * 2, fittedCountRef.current + 50);
    if (shouldFit) {
      chart.timeScale().fitContent();
      fitOnceRef.current = false;
      fittedCountRef.current = candles.length;
    }
  }, [candles, symbol, showEma20, showEma50, showRsi, theme]);

  useEffect(() => {
    fitOnceRef.current = true;
    fittedCountRef.current = 0;
  }, [symbol]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const palette = getChartPalette(theme);

    linesRef.current.forEach((line) => series.removePriceLine(line));
    linesRef.current = [];

    const visible = positions.filter((p) => p.symbol === symbol);
    for (const position of visible) {
      const dragging = draggingId === position.id;
      linesRef.current.push(
        series.createPriceLine({
          price: position.entryPrice,
          color: palette.entry,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `${position.side.toUpperCase()} ${position.lots}`,
        }),
      );
      if (position.stopLoss != null) {
        linesRef.current.push(
          series.createPriceLine({
            price: position.stopLoss,
            color: palette.sl,
            lineWidth: dragging ? 2 : 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "SL",
          }),
        );
      }
      if (position.takeProfit != null) {
        linesRef.current.push(
          series.createPriceLine({
            price: position.takeProfit,
            color: palette.tp,
            lineWidth: dragging ? 2 : 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "TP",
          }),
        );
      }
    }
  }, [positions, symbol, theme, draggingId]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series || !onNeedMoreHistory) return;
    const handler = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      const info = series.barsInLogicalRange(range);
      if (info && info.barsBefore < 20) onNeedMoreHistory();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
  }, [onNeedMoreHistory, candles.length]);

  return <div ref={hostRef} className="absolute inset-0" />;
});
