import { forwardRef, useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Clock, LayoutGrid, List, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyDocPlainText, studyFolderColor } from "@/lib/studyArea";
import { StudyTrashBin, readStudyDragItem, studyDragProps, useStudyTrash } from "./StudyTrash";
import { BoardPreview } from "./BoardPreview";
import { StudyFolderIcon, StudyFolderPlusIcon } from "./StudyFolderIcon";
import type { StudyBoard } from "./studyBoards";
import type { StudyFolder, StudyNote } from "@/hooks/useStudyArea";
export type { StudyBoard };

function PanelSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
        <span>{title}</span>
      </button>
      {open ? <div className="mt-0.5 space-y-0.5">{children}</div> : null}
    </div>
  );
}

const PanelItem = forwardRef<HTMLButtonElement, {
  label: string;
  selected?: boolean;
  dropActive?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
  drag?: ReturnType<typeof studyDragProps>;
}>(function PanelItem({
  label,
  selected,
  dropActive,
  icon,
  trailing,
  onClick,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  drag,
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...drag}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
        selected ? "bg-muted/80 text-foreground" : "text-foreground/80 hover:bg-muted/40",
        dropActive && "bg-primary/15 ring-1 ring-primary/40",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
});

export function StudyHome({
  folders,
  notes,
  boards,
  boardPreviewTick = 0,
  onBoardsChange,
  onOpenNote,
  onOpenBoard,
  onCreateNote,
  onMoveNote,
  onRegisterCreateBoard,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: {
  folders: StudyFolder[];
  notes: StudyNote[];
  boards: StudyBoard[];
  boardPreviewTick?: number;
  onBoardsChange: (updater: (current: StudyBoard[]) => StudyBoard[]) => void;
  onOpenNote: (id: string, title?: string) => void;
  onOpenBoard: (board: StudyBoard) => void;
  onCreateNote: (folderId: string | null) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onRegisterCreateBoard?: (createBoard: (name?: string) => void) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: StudyFolder) => void;
  onDeleteFolder: (folder: StudyFolder) => void;
}) {
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState("all");
  const [homeKind, setHomeKind] = useState<"notes" | "boards">("notes");
  const [noteView, setNoteView] = useState<"list" | "pages">("list");
  const [openSections, setOpenSections] = useState({ study: true, folders: true });
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; folder: StudyFolder } | null>(null);
  const [boardMenu, setBoardMenu] = useState<{ x: number; y: number; board: StudyBoard } | null>(null);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameBoardDraft, setRenameBoardDraft] = useState("");
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const { beginDrag, getDragItem, registerDeleter } = useStudyTrash();
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const orderedFolders = useMemo(
    () => [...folders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [folders],
  );

  useEffect(() => registerDeleter("board", (id) => {
    onBoardsChange((current) => current.filter((board) => board.id !== id));
  }), [onBoardsChange, registerDeleter]);

  useEffect(() => {
    const clearDrop = () => setDropFolderId(null);
    document.addEventListener("dragend", clearDrop);
    return () => document.removeEventListener("dragend", clearDrop);
  }, []);

  useEffect(() => {
    const alive = new Set(folders.map((folder) => folder.id));
    onBoardsChange((current) => {
      let changed = false;
      const next = current.map((board) => {
        if (board.folderId && !alive.has(board.folderId)) {
          changed = true;
          return { ...board, folderId: null };
        }
        return board;
      });
      return changed ? next : current;
    });
  }, [folders, onBoardsChange]);

  useEffect(() => {
    if (folderId === "all" || folderId === "recent") return;
    if (!folderById.has(folderId)) setFolderId("all");
  }, [folderById, folderId]);

  const scopedNotes = useMemo(() => {
    if (folderId === "recent") {
      return [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
    }
    if (folderId === "all") return notes;
    return notes.filter((note) => note.folder_id === folderId);
  }, [folderId, notes]);

  const featured = useMemo(
    () => [...scopedNotes].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null,
    [scopedNotes],
  );
  const createFolderId = folderId === "all" || folderId === "recent" ? null : folderId;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
    const noteRows = [...scopedNotes]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .filter((note) => matches(`${note.title} ${studyDocPlainText(note.content)} ${folderById.get(note.folder_id ?? "")?.name ?? ""}`))
      .map((note) => {
        const folder = note.folder_id ? folderById.get(note.folder_id) : undefined;
        const preview = studyDocPlainText(note.content);
        return {
          key: note.id,
          note,
          title: note.title || "Untitled note",
          folderName: folder?.name,
          preview,
          detail: preview || "Empty note",
          color: studyFolderColor(folder?.color),
          onClick: () => onOpenNote(note.id, note.title || "Untitled note"),
        };
      });
    return noteRows;
  }, [folderById, onOpenNote, query, scopedNotes]);

  const featuredPreview = featured ? studyDocPlainText(featured.content) : "";
  const featuredFolder = featured?.folder_id ? folderById.get(featured.folder_id)?.name : "WorkSpaces";
  const boardRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return boards.filter((board) => {
      if (folderId !== "all" && folderId !== "recent" && board.folderId !== folderId) return false;
      return !needle || board.name.toLowerCase().includes(needle);
    });
  }, [boards, folderId, query]);
  const selectNotes = (nextFolder: string) => {
    setHomeKind("notes");
    setFolderId(nextFolder);
  };
  const createUntitledBoard = useCallback((name = "Untitled board") => {
    const nextFolderId = folderId === "all" || folderId === "recent" ? null : folderId;
    const board = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled board",
      folderId: nextFolderId,
    };
    onBoardsChange((current) => [...current, board]);
    setHomeKind("boards");
    onOpenBoard(board);
  }, [folderId, onBoardsChange, onOpenBoard]);
  const moveBoardToFolder = useCallback((id: string, nextFolderId: string | null) => {
    onBoardsChange((current) =>
      current.map((board) => (board.id === id ? { ...board, folderId: nextFolderId } : board)),
    );
  }, [onBoardsChange]);
  const acceptFolderDrop = (event: DragEvent, targetFolderId: string | null) => {
    const item = getDragItem() ?? readStudyDragItem(event);
    if (!item || (item.kind !== "note" && item.kind !== "board")) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    return true;
  };
  const handleFolderDrop = (event: DragEvent, targetFolderId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropFolderId(null);
    const item = getDragItem() ?? readStudyDragItem(event);
    if (!item) return;
    if (item.kind === "note") onMoveNote(item.id, targetFolderId);
    if (item.kind === "board") moveBoardToFolder(item.id, targetFolderId);
  };
  const folderDropProps = (targetFolderId: string | null, key: string) => ({
    dropActive: dropFolderId === key,
    onDragOver: (event: DragEvent<HTMLButtonElement>) => {
      if (!acceptFolderDrop(event, targetFolderId)) return;
      setDropFolderId(key);
    },
    onDragLeave: (event: DragEvent<HTMLButtonElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDropFolderId((current) => (current === key ? null : current));
    },
    onDrop: (event: DragEvent<HTMLButtonElement>) => handleFolderDrop(event, targetFolderId),
  });
  useEffect(() => {
    onRegisterCreateBoard?.(createUntitledBoard);
  }, [createUntitledBoard, onRegisterCreateBoard]);
  const renameBoard = (id: string, nextName: string) => {
    const name = nextName.trim();
    if (!name) return;
    onBoardsChange((current) => current.map((board) => (board.id === id ? { ...board, name } : board)));
  };
  const commitSidebarBoardRename = () => {
    if (!renamingBoardId) return;
    const existing = boards.find((board) => board.id === renamingBoardId);
    const next = renameBoardDraft.trim();
    if (next && next !== existing?.name) renameBoard(renamingBoardId, next);
    setRenamingBoardId(null);
    setRenameBoardDraft("");
  };
  const deleteBoard = (id: string) => {
    onBoardsChange((current) => current.filter((board) => board.id !== id));
  };
  const toggleSection = (key: "study" | "folders") => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-56">
        <PanelSection title="Study" open={openSections.study} onToggle={() => toggleSection("study")}>
          <PanelItem
            label="WorkSpaces"
            selected={folderId === "all"}
            icon={<List className="h-3.5 w-3.5" />}
            onClick={() => selectNotes("all")}
            {...folderDropProps(null, "all")}
          />
          <PanelItem
            label="Recent notes"
            selected={folderId === "recent"}
            icon={<Clock className="h-3.5 w-3.5" />}
            onClick={() => selectNotes("recent")}
          />
        </PanelSection>
        <PanelSection title="Folders" open={openSections.folders} onToggle={() => toggleSection("folders")}>
          {orderedFolders.map((folder) => {
            const selected = folderId === folder.id;
            const dropping = dropFolderId === folder.id;
            return (
              <PanelItem
                key={folder.id}
                label={folder.name}
                selected={selected}
                icon={<StudyFolderIcon color={folder.color} open={selected || dropping} />}
                trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                onClick={() => selectNotes(folder.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setBoardMenu(null);
                  setFolderMenu({ x: event.clientX, y: event.clientY, folder });
                }}
                drag={studyDragProps({ kind: "folder", id: folder.id, label: folder.name }, beginDrag)}
                {...folderDropProps(folder.id, folder.id)}
              />
            );
          })}
          <PanelItem
            label="New folder"
            icon={<StudyFolderPlusIcon />}
            onClick={onCreateFolder}
          />
        </PanelSection>
      </aside>

      <div className="min-w-0 flex-1 space-y-6 pt-10 sm:pt-14">
          <>
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
              <div className="inline-flex h-10 items-center justify-self-start rounded-full border border-border/50 bg-muted/40 p-1" role="tablist" aria-label="Notes or Boards">
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeKind === "notes"}
                  onClick={() => setHomeKind("notes")}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    homeKind === "notes" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Notes
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={homeKind === "boards"}
                  onClick={() => setHomeKind("boards")}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    homeKind === "boards" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Boards
                </button>
              </div>
              <button
                type="button"
                onClick={() => onCreateNote(createFolderId)}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 justify-self-center rounded-full bg-foreground px-6 text-base font-semibold text-background transition-opacity hover:opacity-90 sm:h-14 sm:px-8 sm:text-lg"
              >
                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                Workspace
              </button>
              <div className="flex w-full items-center justify-end gap-2 justify-self-end sm:w-auto">
                <StudyTrashBin />
                <label className="relative block min-w-0 flex-1 sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={homeKind === "boards" ? "Search boards" : "Search notes"}
                    className="h-10 w-full rounded-full border border-border/50 bg-muted/40 pl-9 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                  />
                </label>
                <div className="inline-flex h-10 shrink-0 items-center rounded-full border border-border/50 bg-muted/40 p-1">
                  <button
                    type="button"
                    aria-label="List view"
                    aria-pressed={noteView === "list"}
                    onClick={() => setNoteView("list")}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-full", noteView === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Page view"
                    aria-pressed={noteView === "pages"}
                    onClick={() => setNoteView("pages")}
                    className={cn("flex h-8 w-8 items-center justify-center rounded-full", noteView === "pages" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {homeKind === "notes" && folderId !== "all" && folderId !== "recent" ? (
              <section className="relative flex min-h-[148px] items-center justify-between gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent px-5 py-5 sm:px-6">
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/70 text-lg font-semibold text-foreground shadow-sm"
                    style={{ color: featured ? studyFolderColor(folderById.get(featured.folder_id ?? "")?.color) : undefined }}
                  >
                    {(featured?.title || "N").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold tracking-tight">
                      {featured?.title || "Start a study note"}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {featured
                        ? [featuredFolder, featuredPreview].filter(Boolean).join(" · ") || "Empty note"
                        : "Write a note, then keep it in a folder."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (featured ? onOpenNote(featured.id) : onCreateNote(createFolderId))}
                  className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  {featured ? "Open" : "New note"}
                </button>
              </section>
            ) : null}

            {homeKind === "boards" ? (
              noteView === "list" ? (
                <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {boardRows.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onCreateNote(createFolderId)}
                      className="col-span-full rounded-xl px-2 py-8 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      No boards yet. Create one.
                    </button>
                  ) : boardRows.map((board) => {
                    const boardFolder = board.folderId ? folderById.get(board.folderId) : undefined;
                    const boardColor = boardFolder ? studyFolderColor(boardFolder.color) : null;
                    return renamingBoardId === board.id ? (
                      <form
                        key={board.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitSidebarBoardRename();
                        }}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            boardColor ? "text-background" : "bg-muted text-muted-foreground",
                          )}
                          style={boardColor ? { background: boardColor } : undefined}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </span>
                        <input
                          autoFocus
                          value={renameBoardDraft}
                          onChange={(event) => setRenameBoardDraft(event.target.value)}
                          onBlur={commitSidebarBoardRename}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setRenamingBoardId(null);
                              setRenameBoardDraft("");
                            }
                          }}
                          aria-label="Rename board"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-border/50 bg-background/60 px-2 text-sm outline-none focus:border-primary/40"
                        />
                      </form>
                    ) : (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => onOpenBoard(board)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setFolderMenu(null);
                          setBoardMenu({ x: event.clientX, y: event.clientY, board });
                        }}
                        {...studyDragProps({ kind: "board", id: board.id, label: board.name }, beginDrag)}
                        className="flex items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            boardColor ? "text-background" : "bg-muted text-muted-foreground",
                          )}
                          style={boardColor ? { background: boardColor } : undefined}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{board.name}</span>
                          <span
                            className={cn("block truncate text-xs font-medium", !boardColor && "text-muted-foreground")}
                            style={boardColor ? { color: boardColor } : undefined}
                          >
                            {boardFolder?.name ?? "Board"}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {boardRows.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onCreateNote(createFolderId)}
                      className="col-span-full rounded-2xl border border-dashed border-border/60 px-4 py-10 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      No boards yet. Create one.
                    </button>
                  ) : boardRows.map((board) => {
                    const boardFolder = board.folderId ? folderById.get(board.folderId) : undefined;
                    const boardColor = boardFolder ? studyFolderColor(boardFolder.color) : null;
                    return (
                      <article
                        key={board.id}
                        className="study-glass rounded-2xl p-3"
                        {...studyDragProps({ kind: "board", id: board.id, label: board.name }, beginDrag)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setFolderMenu(null);
                          setBoardMenu({ x: event.clientX, y: event.clientY, board });
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 px-1">
                          <h3 className="truncate text-sm font-semibold">{boardFolder?.name || board.name}</h3>
                          <button
                            type="button"
                            aria-label="Open board"
                            onClick={() => onOpenBoard(board)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenBoard(board)}
                          className="relative block h-52 w-full overflow-hidden rounded-xl border border-border/40 bg-background/90 text-left shadow-sm"
                        >
                          <BoardPreview boardId={board.id} revision={boardPreviewTick} className="absolute inset-0" />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-3 pb-3 pt-8">
                            {boardFolder ? (
                              <span
                                className="mb-1 inline-flex rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium"
                                style={boardColor ? { color: boardColor } : undefined}
                              >
                                {boardFolder.name}
                              </span>
                            ) : null}
                            <span className="block truncate text-sm font-semibold leading-snug">{board.name}</span>
                          </span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              )
            ) : noteView === "list" ? (
              <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                {rows.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onCreateNote(createFolderId)}
                    className="col-span-full rounded-xl px-2 py-8 text-left text-sm text-muted-foreground hover:text-foreground"
                  >
                    No notes in this category yet. Create one.
                  </button>
                ) : rows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={row.onClick}
                    {...studyDragProps({ kind: "note", id: row.note.id, label: row.title }, beginDrag)}
                    className="flex items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-background"
                      style={{ background: row.color }}
                    >
                      {row.title.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
                    </span>
                    {row.folderName ? (
                      <span className="max-w-[40%] shrink-0 truncate text-xs font-medium text-muted-foreground">{row.folderName}</span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {rows.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onCreateNote(createFolderId)}
                    className="col-span-full rounded-2xl border border-dashed border-border/60 px-4 py-10 text-left text-sm text-muted-foreground hover:text-foreground"
                  >
                    No notes in this category yet. Create one.
                  </button>
                ) : rows.map((row) => (
                  <article
                    key={row.key}
                    className="study-glass rounded-2xl p-3"
                    {...studyDragProps({ kind: "note", id: row.note.id, label: row.title }, beginDrag)}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <h3 className="truncate text-sm font-semibold">{row.folderName || row.title}</h3>
                      <button
                        type="button"
                        aria-label="New note"
                        onClick={() => onCreateNote(row.note.folder_id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={row.onClick}
                      className="block h-52 w-full overflow-hidden rounded-xl border border-border/40 bg-background/90 p-4 text-left shadow-sm"
                    >
                      {row.folderName ? (
                        <span className="inline-flex rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {row.folderName}
                        </span>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{row.title}</p>
                      <p className="mt-2 line-clamp-5 text-xs leading-5 text-muted-foreground">
                        {row.preview || "Empty note"}
                      </p>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
      </div>
      {folderMenu ? createPortal(
        <div
          className="fixed inset-0 z-[200]"
          onMouseDown={() => setFolderMenu(null)}
          onContextMenu={(event) => { event.preventDefault(); setFolderMenu(null); }}
        >
          <div
            className="glass-popup absolute min-w-[9.5rem] rounded-xl p-1"
            style={{ left: Math.min(folderMenu.x, window.innerWidth - 180), top: Math.min(folderMenu.y, window.innerHeight - 96) }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60"
              onClick={() => { onEditFolder(folderMenu.folder); setFolderMenu(null); }}
            >
              Rename
            </button>
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => { onDeleteFolder(folderMenu.folder); setFolderMenu(null); }}
            >
              Delete
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
      {boardMenu ? createPortal(
        <div
          className="fixed inset-0 z-[200]"
          onMouseDown={() => setBoardMenu(null)}
          onContextMenu={(event) => { event.preventDefault(); setBoardMenu(null); }}
        >
          <div
            className="glass-popup absolute min-w-[9.5rem] rounded-xl p-1"
            style={{ left: Math.min(boardMenu.x, window.innerWidth - 180), top: Math.min(boardMenu.y, window.innerHeight - 96) }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60"
              onClick={() => {
                setHomeKind("boards");
                setRenameBoardDraft(boardMenu.board.name);
                setRenamingBoardId(boardMenu.board.id);
                setBoardMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                deleteBoard(boardMenu.board.id);
                setBoardMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
