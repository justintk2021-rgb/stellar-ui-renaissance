import { useMemo, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { isFolderDescendant } from "@/lib/studyArea";
import type { StudyFolder, StudyNote } from "@/hooks/useStudyArea";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type DragPayload = { type: "note" | "folder"; id: string };

function readPayload(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData("application/x-study-area") || event.dataTransfer.getData("text/plain");
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed?.type === "note" || parsed?.type === "folder") return parsed;
  } catch {
    return null;
  }
  return null;
}

export function StudyFolderTree({
  folders,
  notes,
  selectedNoteId,
  onSelectNote,
  onMoveNote,
  onMoveFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folders: StudyFolder[];
  notes: StudyNote[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onMoveNote: (id: string, folderId: string | null) => void;
  onMoveFolder: (id: string, parentId: string | null) => void;
  onRenameFolder: (folder: StudyFolder) => void;
  onDeleteFolder: (folder: StudyFolder) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(folders.map((folder) => folder.id)));
  const children = useMemo(() => {
    const map = new Map<string | null, StudyFolder[]>();
    for (const folder of [...folders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))) {
      const list = map.get(folder.parent_id) ?? [];
      list.push(folder);
      map.set(folder.parent_id, list);
    }
    return map;
  }, [folders]);
  const notesByFolder = useMemo(() => {
    const map = new Map<string | null, StudyNote[]>();
    for (const note of notes) {
      const list = map.get(note.folder_id) ?? [];
      list.push(note);
      map.set(note.folder_id, list);
    }
    return map;
  }, [notes]);

  const dropOn = (event: DragEvent, parentId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readPayload(event);
    if (!payload) return;
    if (payload.type === "note") onMoveNote(payload.id, parentId);
    if (payload.type === "folder") {
      if (payload.id === parentId) return;
      if (parentId && isFolderDescendant(folders, payload.id, parentId)) return;
      onMoveFolder(payload.id, parentId);
    }
  };

  const renderFolder = (folder: StudyFolder, depth: number) => {
    const expanded = open.has(folder.id);
    return (
      <div key={folder.id}>
        <div
          className="flex items-center rounded-lg hover:bg-muted/40"
          style={{ paddingLeft: depth * 14 }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
          onDrop={(event) => dropOn(event, folder.id)}
        >
          <button type="button" className="flex h-8 w-6 items-center justify-center" onClick={() => setOpen((current) => {
            const next = new Set(current);
            if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id);
            return next;
          })}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              const payload = JSON.stringify({ type: "folder", id: folder.id });
              event.dataTransfer.setData("application/x-study-area", payload);
              event.dataTransfer.setData("text/plain", payload);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1 text-left text-sm"
          >
            {expanded ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
            <span className="truncate">{folder.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="mr-1 flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-background/80">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRenameFolder(folder)}><Pencil className="h-3.5 w-3.5" />Rename</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteFolder(folder)}><Trash2 className="h-3.5 w-3.5" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {expanded && (
          <div>
            {(children.get(folder.id) ?? []).map((child) => renderFolder(child, depth + 1))}
            {(notesByFolder.get(folder.id) ?? []).map((note) => (
              <button
                key={note.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  const payload = JSON.stringify({ type: "note", id: note.id });
                  event.dataTransfer.setData("application/x-study-area", payload);
                  event.dataTransfer.setData("text/plain", payload);
                }}
                onClick={() => onSelectNote(note.id)}
                style={{ paddingLeft: 28 + depth * 14 }}
                className={cn("flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm", selectedNoteId === note.id ? "bg-primary/10" : "text-muted-foreground hover:bg-muted/40")}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{note.title || "Untitled note"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="space-y-0.5"
      onDragOver={(event) => { event.preventDefault(); }}
      onDrop={(event) => dropOn(event, null)}
    >
      {(children.get(null) ?? []).map((folder) => renderFolder(folder, 0))}
      {(notesByFolder.get(null) ?? []).map((note) => (
        <button
          key={note.id}
          type="button"
          draggable
          onDragStart={(event) => {
            const payload = JSON.stringify({ type: "note", id: note.id });
            event.dataTransfer.setData("application/x-study-area", payload);
            event.dataTransfer.setData("text/plain", payload);
          }}
          onClick={() => onSelectNote(note.id)}
          className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", selectedNoteId === note.id ? "bg-primary/10" : "text-muted-foreground hover:bg-muted/40")}
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="truncate">{note.title || "Untitled note"}</span>
        </button>
      ))}
    </div>
  );
}
