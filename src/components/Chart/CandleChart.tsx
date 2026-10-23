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
}

export const CandleChart = forwardRef<ChartApi, CandleChartProps>(function CandleChart(
  { candles, symbol, positions, showEma20, showEma50, showRsi, draggingId, onNeedMoreHistory },
  ref,
) {
  const theme = useDocumentTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const fitOnceRef = useRef(true);

  useImperativeHandle(ref, () => ({
    priceToY: (price) => candleSeriesRef.current?.priceToCoordinate(price) ?? null,
    yToPrice: (y) => candleSeriesRef.current?.coordinateToPrice(y) ?? null,
    timeToX: (time) => chartRef.current?.timeScale().timeToCoordinate(asUtc(time)) ?? null,
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
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const palette = getChartPalette(theme);
    const chart = createChart(host, buildChartOptions(palette));
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
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
    candleSeries.applyOptions({
      priceFormat: { type: "price", precision: spec.precision, minMove: spec.minMove },
    });

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
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
        computeEma(candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
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
        computeEma(candles, 50).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
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
        computeRsi(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
    } else if (rsiRef.current) {
      chart.removeSeries(rsiRef.current);
      rsiRef.current = null;
      if (chart.panes().length > 1) {
        chart.removePane(1);
      }
    }

    if (fitOnceRef.current && candles.length) {
      chart.timeScale().fitContent();
      fitOnceRef.current = false;
    }
  }, [candles, symbol, showEma20, showEma50, showRsi, theme]);

  useEffect(() => {
    fitOnceRef.current = true;
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
