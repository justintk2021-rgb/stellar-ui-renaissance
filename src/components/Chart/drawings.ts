export type DrawingTool = "cursor" | "hline" | "trend" | "rect";

export type ChartDrawing =
  | { id: string; type: "hline"; price: number }
  | { id: string; type: "trend"; t1: number; p1: number; t2: number; p2: number }
  | { id: string; type: "rect"; t1: number; p1: number; t2: number; p2: number };

export interface DrawingDraft {
  tool: Exclude<DrawingTool, "cursor">;
  startX: number;
  startY: number;
  startTime: number;
  startPrice: number;
  currentX: number;
  currentY: number;
}

export function createDrawingId(): string {
  return `draw-${Math.random().toString(36).slice(2, 9)}`;
}
