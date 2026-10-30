import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NotebookEntry, Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canMoveFolder,
  folderDescendantIds,
  loadFolders,
  mentionedTradeIds,
  moveFolder,
  resolveNoteFolderId,
  saveFolders,
  seedStudyNoteHtml,
  type StudyFolder,
} from "@/lib/studyNotes";
import { FolderTree, type FolderSelection } from "./FolderTree";
import { NoteEditor } from "./NoteEditor";
import { LiveTradeCard } from "./LiveTradeCard";
import {
  FolderPlus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface StudyNotesViewProps {
  trades: Trade[];
  userId?: string;
  selectedTradeId: string | null;
  onSelectTrade: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
  notebookEntries: NotebookEntry[];
  onSaveEntry: (entry: NotebookEntry) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateTrade?: (id: string, updates: Partial<Trade>) => void | Promise<void>;
  notebookFont?: string;
  onFontChange?: (font: string) => void;
  selectedEntryId?: string | null;
  onSelectedEntryHandled?: () => void;
}

const SAVE_DELAY_MS = 700;

export function StudyNotesView({
  trades,
  userId,
  notebookEntries,
  onSaveEntry,
  onDeleteEntry,
  selectedEntryId,
  onSelectedEntryHandled,
}: StudyNotesViewProps) {
  const { checklists } = useChecklists();
  const playbooks = useMemo(
    () => checklists.map((item) => ({ id: item.id, name: item.name })),
    [checklists],
  );

  const [folders, setFolders] = useState<StudyFolder[]>(() => loadFolders(userId ?? "guest"));
  const [selection, setSelection] = useState<FolderSelection>("all");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "idle">("idle");
  const [draft, setDraft] = useState<NotebookEntry | null>(null);
  const pendingRef = useRef<NotebookEntry | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setFolders(loadFolders(userId ?? "guest"));
  }, [userId]);

  useEffect(() => {
    saveFolders(userId ?? "guest", folders);
  }, [folders, userId]);

  const persistFolders = useCallback((next: StudyFolder[]) => {
    setFolders(next);
    saveFolders(userId ?? "guest", next);
  }, [userId]);

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setSaveState("saving");
    Promise.resolve(onSaveEntry(pending)).finally(() => setSaveState("saved"));
  }, [onSaveEntry]);

  const queueSave = useCallback((entry: NotebookEntry) => {
    pendingRef.current = entry;
    setSaveState("saving");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      Promise.resolve(onSaveEntry(pending)).finally(() => setSaveState("saved"));
    }, SAVE_DELAY_MS);
  }, [onSaveEntry]);

  useEffect(() => () => flushSave(), [flushSave]);

  const activeNotes = useMemo(
    () => notebookEntries.filter((entry) => !entry.isDeleted),
    [notebookEntries],
  );

  const visibleNotes = useMemo(() => {
    if (selection === "trash") return notebookEntries.filter((entry) => entry.isDeleted);
    if (selection === "all") return activeNotes;
    if (selection === "unfiled") {
      return activeNotes.filter((entry) => !resolveNoteFolderId(entry, folders));
    }
    const ids = new Set([selection, ...folderDescendantIds(folders, selection)]);
    return activeNotes.filter((entry) => {
      const folderId = resolveNoteFolderId(entry, folders);
      return folderId != null && ids.has(folderId);
    });
  }, [activeNotes, folders, notebookEntries, selection]);

  const storedNote = notebookEntries.find((entry) => entry.id === activeNoteId) ?? null;
  const selectedNote = draft?.id === storedNote?.id ? draft : storedNote;

  useEffect(() => {
    setDraft(storedNote);
  }, [storedNote?.id]);

  useEffect(() => {
    if (!selectedEntryId) return;
    setActiveNoteId(selectedEntryId);
    const entry = notebookEntries.find((item) => item.id === selectedEntryId);
    if (entry) {
      const folderId = resolveNoteFolderId(entry, folders);
      setSelection(entry.isDeleted ? "trash" : folderId ?? "unfiled");
    }
    onSelectedEntryHandled?.();
  }, [folders, notebookEntries, onSelectedEntryHandled, selectedEntryId]);

  useEffect(() => {
    if (activeNoteId && !notebookEntries.some((entry) => entry.id === activeNoteId)) {
      setActiveNoteId(visibleNotes[0]?.id ?? null);
    }
  }, [activeNoteId, notebookEntries, visibleNotes]);

  const createNote = (folderId: string | null) => {
    flushSave();
    const now = new Date().toISOString();
    const entry: NotebookEntry = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      content: "",
      category: "general",
      folderId,
      date: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    };
    onSaveEntry(entry);
    setDraft(entry);
    setActiveNoteId(entry.id);
    setSelection(folderId ?? "unfiled");
    setSaveState("saved");
  };

  const patchNote = (partial: Partial<NotebookEntry>) => {
    if (!selectedNote || selectedNote.isDeleted) return;
    const base = pendingRef.current?.id === selectedNote.id ? pendingRef.current : selectedNote;
    const next: NotebookEntry = {
      ...base,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    setDraft(next);
    queueSave(next);
  };

  const currentFolderId = selection === "all" || selection === "trash" || selection === "unfiled"
    ? null
    : selection;

  const tradesInNote = selectedNote ? mentionedTradeIds(selectedNote) : [];

  return (
    <div className="study-notes-page grid min-h-[calc(100vh-8rem)] grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="notebook-panel flex flex-col rounded-2xl p-4">
        <div className="mb-4 flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            className="flex-1 justify-center"
            onClick={() => createNote(currentFolderId)}
          >
            <Plus className="h-4 w-4" />
            New note
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-10 w-10 bg-muted text-foreground"
            title="New folder"
            onClick={() => {
              setFolderName("");
              setRenameId(null);
              setFolderDialogOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes"
            className="h-10 bg-background/70 pl-9"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <FolderTree
            folders={folders}
            notes={notebookEntries}
            selection={selection}
            onSelect={setSelection}
            onSelectNote={(id) => {
              flushSave();
              setActiveNoteId(id);
            }}
            selectedNoteId={activeNoteId}
            onMoveNote={(noteId, folderId) => {
              const note = notebookEntries.find((entry) => entry.id === noteId);
              if (!note) return;
              onSaveEntry({ ...note, folderId, updatedAt: new Date().toISOString() });
            }}
            onMoveFolder={(folderId, parentId) => {
              if (!canMoveFolder(folders, folderId, parentId)) return;
              persistFolders(moveFolder(folders, folderId, parentId));
            }}
            onRenameFolder={(folderId) => {
              const folder = folders.find((item) => item.id === folderId);
              if (!folder) return;
              setRenameId(folderId);
              setFolderName(folder.name);
              setFolderDialogOpen(true);
            }}
            onDeleteFolder={(folderId) => {
              const folder = folders.find((item) => item.id === folderId);
              if (!folder) return;
              const removed = new Set([folderId, ...folderDescendantIds(folders, folderId)]);
              notebookEntries.forEach((note) => {
                const noteFolder = resolveNoteFolderId(note, folders);
                if (noteFolder && removed.has(noteFolder)) {
                  onSaveEntry({ ...note, folderId: folder.parentId, updatedAt: new Date().toISOString() });
                }
              });
              persistFolders(folders.filter((item) => !removed.has(item.id)));
              if (typeof selection === "string" && removed.has(selection)) {
                setSelection(folder.parentId ?? "unfiled");
              }
            }}
            search={search}
          />
        </div>
      </aside>

      <section className="notebook-panel flex min-h-[560px] flex-col rounded-2xl p-5 sm:p-6">
        {!selectedNote ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg font-semibold">Study Notes</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Nested folders, autosave, YouTube embeds, and live trade cards live here. Create a note or pick one from the sidebar.
            </p>
            <Button type="button" onClick={() => createNote(currentFolderId)}>
              <Plus className="h-4 w-4" />
              New note
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Study note"}
              </p>
              <div className="flex items-center gap-2">
                {selectedNote.isDeleted ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-muted text-foreground"
                      onClick={() => onSaveEntry({ ...selectedNote, isDeleted: false, deletedAt: undefined, updatedAt: new Date().toISOString() })}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                    <ConfirmDialog
                      title="Delete forever"
                      description="This note will be permanently removed."
                      confirmLabel="Delete"
                      variant="destructive"
                      onConfirm={() => {
                        onDeleteEntry(selectedNote.id);
                        setActiveNoteId(null);
                      }}
                      trigger={
                        <Button type="button" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                          Delete forever
                        </Button>
                      }
                    />
                  </>
                ) : (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="secondary" className="bg-muted text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                          Move
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => patchNote({ folderId: null })}>Unfiled</DropdownMenuItem>
                        {folders.map((folder) => (
                          <DropdownMenuItem key={folder.id} onClick={() => patchNote({ folderId: folder.id })}>
                            {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ConfirmDialog
                      title="Move to trash"
                      description="You can restore this note later from Trash."
                      confirmLabel="Move to trash"
                      variant="destructive"
                      onConfirm={() => {
                        flushSave();
                        onSaveEntry({
                          ...selectedNote,
                          isDeleted: true,
                          deletedAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      trigger={
                        <Button type="button" variant="secondary" className="bg-muted text-foreground">
                          <Trash2 className="h-4 w-4" />
                          Trash
                        </Button>
                      }
                    />
                  </>
                )}
              </div>
            </div>

            <NoteEditor
              noteId={selectedNote.id}
              title={selectedNote.title}
              content={selectedNote.content}
              trades={trades}
              playbooks={playbooks}
              readOnly={!!selectedNote.isDeleted}
              onTitleChange={(title) => patchNote({ title })}
              onContentChange={(html) => patchNote({ content: html })}
            />

            <div className="mt-6 border-t border-border/40 pt-5">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Trades in this note
              </p>
              {tradesInNote.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No journal trades yet. Type /trade to insert a live card.
                </p>
              ) : (
                <div className="space-y-2">
                  {tradesInNote.map((tradeId) => (
                    <LiveTradeCard
                      key={tradeId}
                      tradeId={tradeId}
                      trades={trades}
                      playbooks={playbooks}
                      variant="row"
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameId ? "Rename folder" : "New folder"}</DialogTitle>
          </DialogHeader>
          <Input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="Folder name"
            className="mt-2"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" className="bg-muted text-foreground" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const name = folderName.trim();
                if (!name) return;
                if (renameId) {
                  persistFolders(folders.map((folder) => folder.id === renameId ? { ...folder, name } : folder));
                } else {
                  persistFolders([
                    ...folders,
                    {
                      id: crypto.randomUUID(),
                      name,
                      parentId: currentFolderId,
                      sort: folders.length,
                    },
                  ]);
                }
                setFolderDialogOpen(false);
              }}
            >
              Save folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudyNotesView;
