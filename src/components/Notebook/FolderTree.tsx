import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { NotebookEntry } from "@/types/trade";
import { cn } from "@/lib/utils";
import {
  folderChildIds,
  resolveNoteFolderId,
  type StudyFolder,
} from "@/lib/studyNotes";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Inbox,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FolderSelection = "all" | "unfiled" | "trash" | string;

interface FolderTreeProps {
  folders: StudyFolder[];
  notes: NotebookEntry[];
  selection: FolderSelection;
  onSelect: (selection: FolderSelection) => void;
  onSelectNote: (noteId: string) => void;
  selectedNoteId: string | null;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  search: string;
}

type DragPayload =
  | { type: "note"; id: string }
  | { type: "folder"; id: string };

function readPayload(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData("application/x-study-item") || event.dataTransfer.getData("text/plain");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed?.type === "note" || parsed?.type === "folder") return parsed;
  } catch {
    return null;
  }
  return null;
}

function Droppable({
  active,
  children,
  className,
  onDropPayload,
}: {
  active?: boolean;
  className?: string;
  children: ReactNode;
  onDropPayload: (payload: DragPayload) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn(className, over && active !== false && "ring-2 ring-primary/40 bg-primary/5")}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        const payload = readPayload(event);
        if (payload) onDropPayload(payload);
      }}
    >
      {children}
    </div>
  );
}

function NoteRow({
  note,
  selected,
  depth,
  onSelect,
}: {
  note: NotebookEntry;
  selected: boolean;
  depth: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-study-item", JSON.stringify({ type: "note", id: note.id }));
        event.dataTransfer.setData("text/plain", JSON.stringify({ type: "note", id: note.id }));
      }}
      onClick={onSelect}
      style={{ paddingLeft: 12 + depth * 16 }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition-colors",
        selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{note.title || "Untitled note"}</span>
    </button>
  );
}

function FolderNode({
  folder,
  folders,
  notesByFolder,
  depth,
  selection,
  selectedNoteId,
  expanded,
  onToggle,
  onSelect,
  onSelectNote,
  onMoveNote,
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: StudyFolder;
  folders: StudyFolder[];
  notesByFolder: Map<string | null, NotebookEntry[]>;
  depth: number;
  selection: FolderSelection;
  selectedNoteId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (selection: FolderSelection) => void;
  onSelectNote: (noteId: string) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
}) {
  const open = expanded.has(folder.id);
  const childFolders = folderChildIds(folders, folder.id);
  const childNotes = notesByFolder.get(folder.id) ?? [];
  const selected = selection === folder.id;

  return (
    <div>
      <Droppable
        onDropPayload={(payload) => {
          if (payload.type === "note") onMoveNote(payload.id, folder.id);
          if (payload.type === "folder") onMoveFolder(payload.id, folder.id);
        }}
      >
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-study-item", JSON.stringify({ type: "folder", id: folder.id }));
            event.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", id: folder.id }));
          }}
          onClick={() => onSelect(folder.id)}
          style={{ paddingLeft: 8 + depth * 16 }}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-sm font-medium transition-colors",
            selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
          )}
        >
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(folder.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onToggle(folder.id);
              }
            }}
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-background"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
          {open ? (
            <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
          ) : (
            <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
          )}
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">{childNotes.length}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={() => onRenameFolder(folder.id)}>
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteFolder(folder.id)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </button>
      </Droppable>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {childFolders.map((childId) => {
            const child = folders.find((item) => item.id === childId);
            if (!child) return null;
            return (
              <FolderNode
                key={child.id}
                folder={child}
                folders={folders}
                notesByFolder={notesByFolder}
                depth={depth + 1}
                selection={selection}
                selectedNoteId={selectedNoteId}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                onSelectNote={onSelectNote}
                onMoveNote={onMoveNote}
                onMoveFolder={onMoveFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            );
          })}
          {childNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              selected={selectedNoteId === note.id}
              depth={depth + 1}
              onSelect={() => {
                onSelect(folder.id);
                onSelectNote(note.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  folders,
  notes,
  selection,
  onSelect,
  onSelectNote,
  selectedNoteId,
  onMoveNote,
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
  search,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folders.map((folder) => folder.id)));
  const needle = search.trim().toLowerCase();

  const visibleNotes = useMemo(() => {
    const active = notes.filter((note) => !note.isDeleted);
    if (!needle) return active;
    return active.filter((note) => {
      const haystack = `${note.title} ${note.content}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [notes, needle]);

  const notesByFolder = useMemo(() => {
    const map = new Map<string | null, NotebookEntry[]>();
    for (const note of visibleNotes) {
      const folderId = resolveNoteFolderId(note, folders);
      const list = map.get(folderId) ?? [];
      list.push(note);
      map.set(folderId, list);
    }
    return map;
  }, [visibleNotes, folders]);

  const trashCount = notes.filter((note) => note.isDeleted).length;
  const unfiled = notesByFolder.get(null) ?? [];
  const roots = folderChildIds(folders, null);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          selection === "all" ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
        )}
      >
        <FileText className="h-4 w-4" />
        All notes
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{visibleNotes.length}</span>
      </button>

      <Droppable
        onDropPayload={(payload) => {
          if (payload.type === "note") onMoveNote(payload.id, null);
          if (payload.type === "folder") onMoveFolder(payload.id, null);
        }}
      >
        <button
          type="button"
          onClick={() => onSelect("unfiled")}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
            selection === "unfiled" ? "bg-primary/10 text-foreground" : "hover:bg-muted/50",
          )}
        >
          <Inbox className="h-4 w-4" />
          Unfiled
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">{unfiled.length}</span>
        </button>
      </Droppable>
      {unfiled.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          selected={selectedNoteId === note.id}
          depth={1}
          onSelect={() => {
            onSelect("unfiled");
            onSelectNote(note.id);
          }}
        />
      ))}

      {roots.map((id) => {
        const folder = folders.find((item) => item.id === id);
        if (!folder) return null;
        return (
          <FolderNode
            key={folder.id}
            folder={folder}
            folders={folders}
            notesByFolder={notesByFolder}
            depth={0}
            selection={selection}
            selectedNoteId={selectedNoteId}
            expanded={expanded}
            onToggle={toggle}
            onSelect={onSelect}
            onSelectNote={onSelectNote}
            onMoveNote={onMoveNote}
            onMoveFolder={onMoveFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />
        );
      })}

      <button
        type="button"
        onClick={() => onSelect("trash")}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          selection === "trash" ? "bg-destructive/10 text-destructive" : "hover:bg-muted/50",
        )}
      >
        <Trash2 className="h-4 w-4" />
        Trash
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">{trashCount}</span>
      </button>
      {selection === "trash" && notes.filter((note) => note.isDeleted).map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          selected={selectedNoteId === note.id}
          depth={1}
          onSelect={() => onSelectNote(note.id)}
        />
      ))}
    </div>
  );
}
