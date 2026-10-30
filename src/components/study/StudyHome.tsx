import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderPlus, Plus, Search } from "lucide-react";
import { studyDocPlainText, studyFolderColor } from "@/lib/studyArea";
import type { StudyFolder, StudyNote } from "@/hooks/useStudyArea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function greetingLine(name?: string): string {
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(" ")[0];
  return first ? `${greeting}, ${first}` : greeting;
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
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const orderedFolders = useMemo(
    () => [...folders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [folders],
  );

  useEffect(() => {
    if (folderId === "all" || folderId === "inbox") return;
    if (!folderById.has(folderId)) setFolderId("all");
  }, [folderById, folderId]);

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
  const folderLabel = folderId === "all" ? "All folders" : folderId === "inbox" ? "Inbox" : activeFolder?.name ?? "Folder";
  const createFolderId = folderId === "all" || folderId === "inbox" ? null : folderId;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">{greetingLine(displayName)}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-3 text-sm font-medium text-foreground"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: studyFolderColor(activeFolder?.color) }}
                />
                <span className="truncate">{folderLabel}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{scopedNotes.length}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuRadioGroup value={folderId} onValueChange={setFolderId}>
                <DropdownMenuRadioItem value="all">All folders</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="inbox">Inbox</DropdownMenuRadioItem>
                {orderedFolders.map((folder) => (
                  <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: studyFolderColor(folder.color) }} />
                    {folder.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
          <button
            type="button"
            onClick={onCreateFolder}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <FolderPlus className="h-4 w-4" />
            Folder
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
    </div>
  );
}
