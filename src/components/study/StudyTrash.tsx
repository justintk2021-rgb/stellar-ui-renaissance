import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudyTrashKind = "note" | "folder" | "board" | "trade";

export type StudyTrashItem = {
  kind: StudyTrashKind;
  id: string;
  label: string;
};

type Deleter = (id: string) => void;

type StudyTrashContextValue = {
  beginDrag: (event: ReactDragEvent, item: StudyTrashItem) => void;
  registerDeleter: (kind: StudyTrashKind, deleter: Deleter) => () => void;
};

const StudyTrashContext = createContext<StudyTrashContextValue | null>(null);

const MIME = "application/x-study-trash";

function emptyDragImage(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
}

export function useStudyTrash() {
  const value = useContext(StudyTrashContext);
  if (!value) throw new Error("Study trash is only available inside Study Area.");
  return value;
}

export function studyDragProps(item: StudyTrashItem, beginDrag: (event: ReactDragEvent, item: StudyTrashItem) => void) {
  return {
    draggable: true,
    onDragStart: (event: ReactDragEvent) => beginDrag(event, item),
  };
}

export function StudyTrashProvider({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: (item: StudyTrashItem) => void;
}) {
  const deleters = useRef<Partial<Record<StudyTrashKind, Deleter>>>({});
  const dragImage = useRef<HTMLCanvasElement | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [hot, setHot] = useState(false);
  const dragging = useRef<StudyTrashItem | null>(null);

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
        setGhost((current) => current ? { ...current, x: point.x, y: point.y } : current);
      });
    };
    const end = () => {
      dragging.current = null;
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

  const beginDrag = useCallback((event: ReactDragEvent, item: StudyTrashItem) => {
    dragging.current = item;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(MIME, JSON.stringify(item));
    event.dataTransfer.setData("text/plain", item.label);
    if (!dragImage.current) dragImage.current = emptyDragImage();
    event.dataTransfer.setDragImage(dragImage.current, 0, 0);
    setGhost({ x: event.clientX, y: event.clientY, label: item.label });
  }, []);

  const registerDeleter = useCallback((kind: StudyTrashKind, deleter: Deleter) => {
    deleters.current[kind] = deleter;
    return () => {
      if (deleters.current[kind] === deleter) delete deleters.current[kind];
    };
  }, []);

  const value = useMemo(() => ({ beginDrag, registerDeleter }), [beginDrag, registerDeleter]);

  const drop = (event: ReactDragEvent) => {
    event.preventDefault();
    setHot(false);
    setGhost(null);
    const item = dragging.current;
    dragging.current = null;
    if (!item) return;
    if (item.kind === "note" || item.kind === "folder") onDelete(item);
    else deleters.current[item.kind]?.(item.id);
  };

  return (
    <StudyTrashContext.Provider value={value}>
      {children}
      <div
        aria-label="Trash"
        onDragOver={(event) => {
          if (!dragging.current) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setHot(true);
        }}
        onDragLeave={() => setHot(false)}
        onDrop={drop}
        className={cn(
          "fixed right-[7.25rem] top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-card/80 text-muted-foreground shadow-sm backdrop-blur-xl transition-transform",
          hot && "scale-110 border-destructive/50 bg-destructive/15 text-destructive",
        )}
      >
        <Trash2 className={cn("h-5 w-5 transition-transform", hot && "scale-110")} />
      </div>
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
