import { useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "@/lib/chartTrading/types";
import { getChartPalette } from "./chartTheme";
import type { ChartApi } from "./CandleChart";
import {
  createDrawingId,
  type ChartDrawing,
  type DrawingDraft,
  type DrawingTool,
} from "./drawings";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";

interface DrawingOverlayProps {
  chartApi: ChartApi | null;
  tool: DrawingTool;
  drawings: ChartDrawing[];
  onDrawingsChange: (next: ChartDrawing[]) => void;
  positions: Position[];
  symbol: string;
  onDragLevel: (positionId: string, kind: "sl" | "tp", price: number) => void;
  onDragStart: (positionId: string | null) => void;
}

interface LevelHandle {
  id: string;
  kind: "sl" | "tp";
  price: number;
}

export function DrawingOverlay({
  chartApi,
  tool,
  drawings,
  onDrawingsChange,
  positions,
  symbol,
  onDragLevel,
  onDragStart,
}: DrawingOverlayProps) {
  const theme = useDocumentTheme();
  const palette = getChartPalette(theme);
  const svgRef = useRef<SVGSVGElement>(null);
  const [rev, setRev] = useState(0);
  const [draft, setDraft] = useState<DrawingDraft | null>(null);
  const [drag, setDrag] = useState<LevelHandle | null>(null);

  useEffect(() => {
    if (!chartApi) return;
    return chartApi.subscribeViewChange(() => setRev((n) => n + 1));
  }, [chartApi]);

  const mapped = useMemo(() => {
    if (!chartApi) return [];
    return drawings
      .map((drawing) => {
        if (drawing.type === "hline") {
          const y = chartApi.priceToY(drawing.price);
          if (y == null) return null;
          return { drawing, y };
        }
        const x1 = chartApi.timeToX(drawing.t1);
        const x2 = chartApi.timeToX(drawing.t2);
        const y1 = chartApi.priceToY(drawing.p1);
        const y2 = chartApi.priceToY(drawing.p2);
        if (x1 == null || x2 == null || y1 == null || y2 == null) return null;
        return { drawing, x1, x2, y1, y2 };
      })
      .filter(Boolean);
    // rev forces a remap after zoom/pan
  }, [chartApi, drawings, rev]);

  const handles = useMemo<Array<LevelHandle & { y: number }>>(() => {
    if (!chartApi) return [];
    return positions
      .filter((p) => p.symbol === symbol)
      .flatMap((p) => {
        const items: Array<LevelHandle & { y: number }> = [];
        if (p.stopLoss != null) {
          const y = chartApi.priceToY(p.stopLoss);
          if (y != null) items.push({ id: p.id, kind: "sl", price: p.stopLoss, y });
        }
        if (p.takeProfit != null) {
          const y = chartApi.priceToY(p.takeProfit);
          if (y != null) items.push({ id: p.id, kind: "tp", price: p.takeProfit, y });
        }
        return items;
      });
  }, [chartApi, positions, symbol, rev]);

  const hitHandle = (y: number) =>
    handles.find((handle) => Math.abs(handle.y - y) <= 8) ?? null;

  const localPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const finishDraft = (next: DrawingDraft) => {
    if (!chartApi) return;
    if (next.tool === "hline") {
      onDrawingsChange([
        ...drawings,
        { id: createDrawingId(), type: "hline", price: next.startPrice },
      ]);
      return;
    }
    const endTime = chartApi.xToTime(next.currentX) ?? next.startTime;
    const endPrice = chartApi.yToPrice(next.currentY) ?? next.startPrice;
    onDrawingsChange([
      ...drawings,
      next.tool === "trend"
        ? {
            id: createDrawingId(),
            type: "trend",
            t1: next.startTime,
            p1: next.startPrice,
            t2: endTime,
            p2: endPrice,
          }
        : {
            id: createDrawingId(),
            type: "rect",
            t1: next.startTime,
            p1: next.startPrice,
            t2: endTime,
            p2: endPrice,
          },
    ]);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!chartApi) return;
    const { x, y } = localPoint(event);
    const handle = hitHandle(y);
    if (handle && tool === "cursor") {
      event.preventDefault();
      svgRef.current?.setPointerCapture(event.pointerId);
      setDrag(handle);
      onDragStart(handle.id);
      return;
    }
    if (tool === "cursor") return;
    const time = chartApi.xToTime(x);
    const price = chartApi.yToPrice(y);
    if (time == null || price == null) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    setDraft({
      tool,
      startX: x,
      startY: y,
      startTime: time,
      startPrice: price,
      currentX: x,
      currentY: y,
    });
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!chartApi) return;
    const { x, y } = localPoint(event);
    if (drag) {
      const price = chartApi.yToPrice(y);
      if (price != null) onDragLevel(drag.id, drag.kind, price);
      return;
    }
    if (draft) {
      setDraft({ ...draft, currentX: x, currentY: y });
    }
  };

  const onPointerUp = () => {
    if (drag) {
      setDrag(null);
      onDragStart(null);
    }
    if (draft) {
      finishDraft(draft);
      setDraft(null);
    }
  };

  const capturing = tool !== "cursor" || Boolean(drag);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-10 h-full w-full"
      style={{
        pointerEvents: capturing ? "auto" : "none",
        cursor: tool === "cursor" ? (drag ? "ns-resize" : "default") : "crosshair",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {mapped.map((item) => {
        if (!item) return null;
        if (item.drawing.type === "hline") {
          return (
            <line
              key={item.drawing.id}
              x1="0"
              x2="100%"
              y1={item.y}
              y2={item.y}
              stroke={palette.ema20}
              strokeWidth="1.25"
              strokeDasharray="6 4"
            />
          );
        }
        if (item.drawing.type === "trend") {
          return (
            <line
              key={item.drawing.id}
              x1={item.x1}
              y1={item.y1}
              x2={item.x2}
              y2={item.y2}
              stroke={palette.ema50}
              strokeWidth="1.5"
            />
          );
        }
        const x = Math.min(item.x1, item.x2);
        const y = Math.min(item.y1, item.y2);
        return (
          <rect
            key={item.drawing.id}
            x={x}
            y={y}
            width={Math.abs(item.x2 - item.x1)}
            height={Math.abs(item.y2 - item.y1)}
            fill={palette.ema20 + "22"}
            stroke={palette.ema20}
            strokeWidth="1.25"
          />
        );
      })}

      {draft && draft.tool === "hline" && (
        <line x1="0" x2="100%" y1={draft.currentY} y2={draft.currentY} stroke={palette.ema20} strokeDasharray="4 3" />
      )}
      {draft && draft.tool === "trend" && (
        <line
          x1={draft.startX}
          y1={draft.startY}
          x2={draft.currentX}
          y2={draft.currentY}
          stroke={palette.ema50}
          strokeWidth="1.5"
        />
      )}
      {draft && draft.tool === "rect" && (
        <rect
          x={Math.min(draft.startX, draft.currentX)}
          y={Math.min(draft.startY, draft.currentY)}
          width={Math.abs(draft.currentX - draft.startX)}
          height={Math.abs(draft.currentY - draft.startY)}
          fill={palette.ema20 + "22"}
          stroke={palette.ema20}
        />
      )}

      {handles.map((handle) => (
        <g key={`${handle.id}-${handle.kind}`} style={{ pointerEvents: "auto" }}>
          <line
            x1="0"
            x2="100%"
            y1={handle.y}
            y2={handle.y}
            stroke="transparent"
            strokeWidth="14"
            style={{ cursor: "ns-resize" }}
          />
          <circle
            cx="18"
            cy={handle.y}
            r="5"
            fill={handle.kind === "sl" ? palette.sl : palette.tp}
            stroke="white"
            strokeWidth="1"
          />
        </g>
      ))}
    </svg>
  );
}
