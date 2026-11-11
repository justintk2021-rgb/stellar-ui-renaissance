import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudyTrashKind = "note" | "folder" | "board" | "trade" | "video";

export type StudyTrashItem = {
  kind: StudyTrashKind;
  id: string;
  label: string;
};

type Deleter = (id: string) => void;

type StudyTrashContextValue = {
  beginDrag: (event: ReactDragEvent, itemOrItems: StudyTrashItem | StudyTrashItem[]) => void;
  getDragItem: () => StudyTrashItem | null;
  getDragItems: () => StudyTrashItem[];
  registerDeleter: (kind: StudyTrashKind, deleter: Deleter) => () => void;
  binHot: boolean;
  trashCount: number;
  openBin: () => void;
  binHandlers: {
    onDragOver: (event: ReactDragEvent) => void;
    onDragLeave: () => void;
    onDrop: (event: ReactDragEvent) => void;
  };
};

const StudyTrashContext = createContext<StudyTrashContextValue | null>(null);

export const STUDY_DRAG_MIME = "application/x-study-trash";

function normalizeItems(parsed: unknown): StudyTrashItem[] {
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as { items?: unknown; kind?: unknown; id?: unknown; label?: unknown };
  if (Array.isArray(record.items)) {
    return record.items.filter(
      (item): item is StudyTrashItem =>
        !!item &&
        typeof item === "object" &&
        typeof (item as StudyTrashItem).kind === "string" &&
        typeof (item as StudyTrashItem).id === "string",
    );
  }
  if (typeof record.kind === "string" && typeof record.id === "string") {
    return [{ kind: record.kind as StudyTrashKind, id: record.id, label: String(record.label ?? "") }];
  }
  return [];
}

export function readStudyDragItems(event: { dataTransfer: DataTransfer }): StudyTrashItem[] {
  try {
    const raw = event.dataTransfer.getData(STUDY_DRAG_MIME);
    if (!raw) return [];
    return normalizeItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function readStudyDragItem(event: { dataTransfer: DataTransfer }): StudyTrashItem | null {
  return readStudyDragItems(event)[0] ?? null;
}

export function trashItemKey(item: Pick<StudyTrashItem, "kind" | "id">) {
  return `${item.kind}:${item.id}`;
}

function emptyDragImage(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
}

function ghostLabelFor(items: StudyTrashItem[]) {
  if (items.length <= 1) return items[0]?.label || "Item";
  return `${items.length} items`;
}

export function StudyTrashBin({ className }: { className?: string }) {
  const { binHot, binHandlers, openBin, trashCount } = useStudyTrash();
  return (
    <button
      type="button"
      aria-label={trashCount > 0 ? `Bin, ${trashCount} items` : "Bin"}
      title={
        trashCount > 0
          ? `Bin · ${trashCount} — click to manage, or drop items here`
          : "Bin — click to open, or drop items here"
      }
      onClick={openBin}
      {...binHandlers}
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted/40 text-muted-foreground transition-transform",
        binHot && "scale-110 border-destructive/50 bg-destructive/15 text-destructive",
        className,
      )}
    >
      <Trash2 className={cn("h-4 w-4 transition-transform", binHot && "scale-110")} />
      {trashCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
          {trashCount > 99 ? "99+" : trashCount}
        </span>
      ) : null}
    </button>
  );
}

export function useStudyTrash() {
  const value = useContext(StudyTrashContext);
  if (!value) throw new Error("Study trash is only available inside Study Area.");
  return value;
}

export function studyDragProps(
  item: StudyTrashItem,
  beginDrag: (event: ReactDragEvent, itemOrItems: StudyTrashItem | StudyTrashItem[]) => void,
  selection: StudyTrashItem[] = [],
) {
  return {
    draggable: true as const,
    onDragStart: (event: ReactDragEvent) => {
      const inSelection = selection.some((selected) => trashItemKey(selected) === trashItemKey(item));
      beginDrag(event, inSelection && selection.length > 1 ? selection : [item]);
    },
  };
}

export function StudyTrashProvider({
  children,
  onDelete,
  openBin,
  trashCount = 0,
  visible = false,
}: {
  children: ReactNode;
  onDelete: (items: StudyTrashItem[]) => void;
  openBin: () => void;
  trashCount?: number;
  visible?: boolean;
}) {
  const deleters = useRef<Partial<Record<StudyTrashKind, Deleter>>>({});
  const dragImage = useRef<HTMLCanvasElement | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [hot, setHot] = useState(false);
  const dragging = useRef<StudyTrashItem[]>([]);

  useEffect(() => {
    if (!ghost) return;
    let frame = 0;
    const point = { x: ghost.x, y: ghost.y };
    const track = (event: globalThis.DragEvent) => {
      if (!event.clientX && !event.clientY) return;
      point.x = event.clientX;
      point.y = event.clientY;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setGhost((current) => (current ? { ...current, x: point.x, y: point.y } : current));
      });
    };
    const end = () => {
      dragging.current = [];
      setGhost(null);
      setHot(false);
    };
    document.addEventListener("dragover", track);
    document.addEventListener("dragend", end);
    return () => {
      document.removeEventListener("dragover", track);
      document.removeEventListener("dragend", end);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ghost?.label]);

  const beginDrag = useCallback((event: ReactDragEvent, itemOrItems: StudyTrashItem | StudyTrashItem[]) => {
    const items = (Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems]).filter(
      (item, index, list) => list.findIndex((other) => trashItemKey(other) === trashItemKey(item)) === index,
    );
    if (items.length === 0) return;
    dragging.current = items;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(STUDY_DRAG_MIME, JSON.stringify({ items }));
    event.dataTransfer.setData("text/plain", ghostLabelFor(items));
    if (!dragImage.current) dragImage.current = emptyDragImage();
    event.dataTransfer.setDragImage(dragImage.current, 0, 0);
    setGhost({ x: event.clientX, y: event.clientY, label: ghostLabelFor(items) });
  }, []);

  const getDragItems = useCallback(() => dragging.current, []);
  const getDragItem = useCallback(() => dragging.current[0] ?? null, []);

  const registerDeleter = useCallback((kind: StudyTrashKind, deleter: Deleter) => {
    deleters.current[kind] = deleter;
    return () => {
      if (deleters.current[kind] === deleter) delete deleters.current[kind];
    };
  }, []);

  const drop = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      setHot(false);
      setGhost(null);
      const items = dragging.current.length > 0 ? dragging.current : readStudyDragItems(event);
      dragging.current = [];
      if (items.length === 0) return;

      const managed = items.filter((item) => item.kind === "note" || item.kind === "folder");
      if (managed.length > 0) onDelete(managed);

      for (const item of items) {
        if (item.kind === "note" || item.kind === "folder") continue;
        deleters.current[item.kind]?.(item.id);
      }
    },
    [onDelete],
  );

  const binHandlers = useMemo(
    () => ({
      onDragOver: (event: ReactDragEvent) => {
        if (dragging.current.length === 0) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setHot(true);
      },
      onDragLeave: () => setHot(false),
      onDrop: drop,
    }),
    [drop],
  );

  const value = useMemo(
    () => ({
      beginDrag,
      getDragItem,
      getDragItems,
      registerDeleter,
      binHot: hot,
      trashCount,
      openBin,
      binHandlers,
    }),
    [beginDrag, getDragItem, getDragItems, registerDeleter, hot, trashCount, openBin, binHandlers],
  );

  return (
    <StudyTrashContext.Provider value={value}>
      {children}
      {visible ? <StudyTrashBin className="fixed right-[7.25rem] top-4 z-[70] h-11 w-11" /> : null}
      {ghost ? (
        <div
          className="study-drag-ghost pointer-events-none fixed z-[80] rounded-full border border-border/50 bg-card/95 px-3 py-1.5 text-sm font-medium shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.label}
        </div>
      ) : null}
    </StudyTrashContext.Provider>
  );
}
