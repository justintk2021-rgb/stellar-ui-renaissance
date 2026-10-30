import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FolderPlus, Inbox, LayoutGrid, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyDocPlainText, studyFolderColor } from "@/lib/studyArea";
import type { StudyFolder, StudyNote } from "@/hooks/useStudyArea";

const BOARDS_KEY = "nsync-study-boards";

type StudyBoard = { id: string; name: string };

function greetingLine(name?: string): string {
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(" ")[0];
  return first ? `${greeting}, ${first}` : greeting;
}

function readBoards(): StudyBoard[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudyBoard[];
    return Array.isArray(parsed) ? parsed.filter((board) => board?.id && board?.name) : [];
  } catch {
    return [];
  }
}

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

function PanelItem({
  label,
  selected,
  icon,
  trailing,
  onClick,
}: {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
        selected ? "bg-muted/80 text-foreground" : "text-foreground/80 hover:bg-muted/40",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function StudyHome({
  displayName,
  folders,
  notes,
  onOpenNote,
  onCreateNote,
  onCreateFolder,
}: {
  displayName?: string;
  folders: StudyFolder[];
  notes: StudyNote[];
  onOpenNote: (id: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onCreateFolder: () => void;
}) {
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState("all");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boards, setBoards] = useState<StudyBoard[]>(readBoards);
  const [boardName, setBoardName] = useState("");
  const [addingBoard, setAddingBoard] = useState(false);
  const [openSections, setOpenSections] = useState({ study: true, folders: true, boards: true });
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const orderedFolders = useMemo(
    () => [...folders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [folders],
  );

  useEffect(() => {
    if (folderId === "all" || folderId === "inbox") return;
    if (!folderById.has(folderId)) setFolderId("all");
  }, [folderById, folderId]);

  useEffect(() => {
    try {
      localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
    } catch {
      // Board names stay in memory if storage is blocked.
    }
  }, [boards]);

  const scopedNotes = useMemo(() => {
    if (folderId === "inbox") return notes.filter((note) => !note.folder_id);
    if (folderId === "all") return notes;
    return notes.filter((note) => note.folder_id === folderId);
  }, [folderId, notes]);

  const featured = useMemo(
    () => [...scopedNotes].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null,
    [scopedNotes],
  );
  const activeFolder = folderId !== "all" && folderId !== "inbox" ? folderById.get(folderId) : undefined;
  const createFolderId = folderId === "all" || folderId === "inbox" ? null : folderId;
  const activeBoard = boards.find((board) => board.id === boardId) ?? null;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
    const noteRows = [...scopedNotes]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .filter((note) => matches(`${note.title} ${studyDocPlainText(note.content)} ${folderById.get(note.folder_id ?? "")?.name ?? "Inbox"}`))
      .map((note) => {
        const folder = note.folder_id ? folderById.get(note.folder_id) : undefined;
        const preview = studyDocPlainText(note.content);
        return {
          key: note.id,
          title: note.title || "Untitled note",
          detail: [folder?.name ?? "Inbox", preview].filter(Boolean).join(" · ") || "Empty note",
          color: studyFolderColor(folder?.color),
          onClick: () => onOpenNote(note.id),
        };
      });
    const showEmptyFolder = activeFolder && noteRows.length === 0 && matches(activeFolder.name);
    return showEmptyFolder
      ? [{
          key: activeFolder.id,
          title: activeFolder.name,
          detail: "Empty folder · add a note",
          color: studyFolderColor(activeFolder.color),
          onClick: () => onCreateNote(activeFolder.id),
        }]
      : noteRows;
  }, [activeFolder, folderById, onCreateNote, onOpenNote, query, scopedNotes]);

  const featuredPreview = featured ? studyDocPlainText(featured.content) : "";
  const featuredFolder = featured?.folder_id ? folderById.get(featured.folder_id)?.name : "Inbox";
  const selectNotes = (nextFolder: string) => {
    setBoardId(null);
    setFolderId(nextFolder);
  };
  const saveBoard = () => {
    const name = boardName.trim();
    if (!name) return;
    const board = { id: crypto.randomUUID(), name };
    setBoards((current) => [...current, board]);
    setBoardName("");
    setAddingBoard(false);
    setBoardId(board.id);
  };
  const toggleSection = (key: "study" | "folders" | "boards") => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-56">
        <PanelSection title="Study" open={openSections.study} onToggle={() => toggleSection("study")}>
          <PanelItem
            label="All notes"
            selected={!activeBoard && folderId === "all"}
            icon={<Search className="h-3.5 w-3.5" />}
            onClick={() => selectNotes("all")}
          />
          <PanelItem
            label="Inbox"
            selected={!activeBoard && folderId === "inbox"}
            icon={<Inbox className="h-3.5 w-3.5" />}
            onClick={() => selectNotes("inbox")}
          />
        </PanelSection>
        <PanelSection title="Folders" open={openSections.folders} onToggle={() => toggleSection("folders")}>
          {orderedFolders.map((folder) => (
            <PanelItem
              key={folder.id}
              label={folder.name}
              selected={!activeBoard && folderId === folder.id}
              icon={<span className="h-2.5 w-2.5 rounded-full" style={{ background: studyFolderColor(folder.color) }} />}
              trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={() => selectNotes(folder.id)}
            />
          ))}
          <PanelItem
            label="New folder"
            icon={<FolderPlus className="h-3.5 w-3.5" />}
            onClick={onCreateFolder}
          />
        </PanelSection>
        <PanelSection title="Boards" open={openSections.boards} onToggle={() => toggleSection("boards")}>
          {boards.map((board) => (
            <PanelItem
              key={board.id}
              label={board.name}
              selected={boardId === board.id}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={() => setBoardId(board.id)}
            />
          ))}
          {addingBoard ? (
            <form
              className="px-2 py-1"
              onSubmit={(event) => {
                event.preventDefault();
                saveBoard();
              }}
            >
              <input
                autoFocus
                value={boardName}
                onChange={(event) => setBoardName(event.target.value)}
                onBlur={() => { if (!boardName.trim()) setAddingBoard(false); }}
                placeholder="Board name"
                className="h-8 w-full rounded-lg border border-border/50 bg-background/60 px-2 text-sm outline-none focus:border-primary/40"
              />
            </form>
          ) : (
            <PanelItem label="New board" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddingBoard(true)} />
          )}
        </PanelSection>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        {activeBoard ? (
          <section className="study-glass min-h-[320px] rounded-2xl p-6">
            <h3 className="text-lg font-semibold tracking-tight">{activeBoard.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">This board is empty.</p>
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{greetingLine(displayName)}</p>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <label className="relative block min-w-0 flex-1 sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search notes"
                    className="h-10 w-full rounded-full border border-border/50 bg-muted/40 pl-9 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onCreateNote(createFolderId)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Note
                </button>
              </div>
            </div>

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
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
