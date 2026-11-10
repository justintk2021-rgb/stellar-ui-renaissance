import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { JSONContent } from "@tiptap/core";
import type { NotebookEntry, Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useStudyMutations, useStudyTree, type StudyFolder, type StudyNote } from "@/hooks/useStudyArea";
import { STUDY_FOLDER_COLORS, type StudyCategory } from "@/lib/studyArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BoardCanvas } from "./BoardCanvas";
import { StudyEditor } from "./StudyEditor";
import { StudyHome } from "./StudyHome";
import { StudyNoteComposer } from "./StudyNoteComposer";
import { StudyTabStrip } from "./StudyTabStrip";
import { StudyTrashProvider, type StudyTrashItem } from "./StudyTrash";
import { persistBoards, readBoards, type StudyBoard } from "./studyBoards";
import {
  HOME_TAB,
  HOME_TAB_KEY,
  boardTabKey,
  ensureHomeFirst,
  neighborAfterClose,
  noteTabKey,
  removeTab,
  stripNoteTabs,
  syncBoardTabTitle,
  syncNoteTabTitle,
  upsertBoardTab,
  upsertNoteTab,
  type StudyTab,
} from "./studyTabs";
import { AnimatePresence, motion } from "@/lib/motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function previewParagraph(text: string): JSONContent {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

/** Local-only sample tree so marketing screenshots can show stacked folder cards. */
function marketingPreviewTree(category: StudyCategory): { folders: StudyFolder[]; notes: StudyNote[] } | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("preview") !== "marketing") return null;
  const now = new Date().toISOString();
  const folder = (id: string, name: string, color: string, sort: number): StudyFolder => ({
    id: `${category}-${id}`,
    user_id: "preview",
    parent_id: null,
    name,
    category,
    color,
    sort_order: sort,
    updated_at: now,
  });
  const note = (id: string, title: string, folderId: string | null, text: string): StudyNote => ({
    id: `${category}-${id}`,
    user_id: "preview",
    folder_id: folderId,
    title,
    category,
    content: previewParagraph(text),
    updated_at: now,
  });
  const prefix = category === "collaborative" ? "Shared " : category === "case" ? "Case " : "";
  return {
    folders: [
      folder("f1", `${prefix}Setups`, "hsl(217 91% 60%)", 0),
      folder("f2", `${prefix}Reviews`, "hsl(262 83% 58%)", 1),
      folder("f3", `${prefix}Playbook`, "hsl(142 71% 45%)", 2),
    ],
    notes: [
      note("n1", "London open checklist", `${category}-f1`, "Mark Asia range, wait for the sweep, then take the displacement."),
      note("n2", "EURUSD bias", `${category}-f1`, "Daily is still discount. Only take longs against the prior week high."),
      note("n3", "Friday recap", `${category}-f2`, "Cut size after two losses. The afternoon session was cleaner."),
      note("n4", "Risk notes", `${category}-f2`, "Cap the day at one R if the first trade is a scratch."),
      note("n5", "A+ model", `${category}-f3`, "Sweep, displacement, FVG retest. Skip if news is inside 15 minutes."),
      note("n6", "Quick thought", null, "The 9:30 spike is not a setup by itself."),
      note("n7", "Session reminder", null, "No trades into the New York lunch chop."),
    ],
  };
}

export function StudyArea({
  userId,
  trades,
  notebookEntries = [],
  focusNoteId,
  onFocusHandled,
  category,
  onOpenJournal,
  onOpenPlaybook,
}: {
  userId?: string;
  trades: Trade[];
  notebookEntries?: NotebookEntry[];
  focusNoteId?: string | null;
  onFocusHandled?: () => void;
  category: StudyCategory;
  displayName?: string;
  onOpenJournal?: (tradeId: string) => void;
  onOpenPlaybook?: (playbookId: string | null) => void;
}) {
  const tree = useStudyTree(userId);
  const mutations = useStudyMutations(userId);
  const { checklists } = useChecklists();
  const playbooks = useMemo(() => checklists.map((item) => ({ id: item.id, name: item.name })), [checklists]);
  const [tabs, setTabs] = useState<StudyTab[]>([HOME_TAB]);
  const [activeKey, setActiveKey] = useState<string>(HOME_TAB_KEY);
  const [boards, setBoards] = useState<StudyBoard[]>(readBoards);
  const [boardPreviewTick, setBoardPreviewTick] = useState(0);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderEditId, setFolderEditId] = useState<string | null>(null);
  const [composerFolderId, setComposerFolderId] = useState<string | null | undefined>(undefined);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("");
  const [optimisticNotes, setOptimisticNotes] = useState<StudyNote[]>([]);
  const createBoardRef = useRef<((name?: string) => void) | null>(null);
  const registerCreateBoard = useCallback((createBoard: (name?: string) => void) => {
    createBoardRef.current = createBoard;
  }, []);
  const liveFolders = (tree.data?.folders ?? []).filter((folder) => folder.category === category);
  const liveNotes = (tree.data?.notes ?? []).filter((note) => note.category === category);
  const preview = liveFolders.length === 0 && liveNotes.length === 0 ? marketingPreviewTree(category) : null;
  const folders = preview?.folders ?? liveFolders;
  const notes = useMemo(() => {
    const base = preview?.notes ?? liveNotes;
    if (optimisticNotes.length === 0) return base;
    const byId = new Map(base.map((note) => [note.id, note]));
    for (const note of optimisticNotes) {
      if (!byId.has(note.id)) byId.set(note.id, note);
    }
    return Array.from(byId.values());
  }, [liveNotes, optimisticNotes, preview?.notes]);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  useEffect(() => {
    if (optimisticNotes.length === 0) return;
    const liveIds = new Set(liveNotes.map((note) => note.id));
    setOptimisticNotes((current) => {
      const next = current.filter((note) => !liveIds.has(note.id));
      return next.length === current.length ? current : next;
    });
  }, [liveNotes, optimisticNotes.length]);

  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? HOME_TAB;
  const selectedNote =
    activeTab.kind === "note" ? notes.find((note) => note.id === activeTab.id) ?? null : null;
  const selectedBoard =
    activeTab.kind === "board" ? boards.find((board) => board.id === activeTab.id) ?? null : null;

  const updateBoards = useCallback((updater: (current: StudyBoard[]) => StudyBoard[]) => {
    setBoards((current) => {
      const next = updater(current);
      persistBoards(next);
      return next;
    });
  }, []);

  const folderColorForNote = useCallback((folderId: string | null | undefined) => {
    if (!folderId) return null;
    return folderById.get(folderId)?.color ?? null;
  }, [folderById]);

  const openNoteTab = useCallback((id: string, title?: string) => {
    const note = notes.find((item) => item.id === id);
    const nextTitle = title?.trim() || note?.title?.trim() || "Untitled note";
    const color = folderColorForNote(note?.folder_id);
    setTabs((current) => upsertNoteTab(current, id, nextTitle, color));
    setActiveKey(noteTabKey(id));
  }, [folderColorForNote, notes]);

  const openBoardTab = useCallback((board: StudyBoard) => {
    const color = board.folderId ? folderById.get(board.folderId)?.color ?? null : null;
    setTabs((current) => upsertBoardTab(current, board.id, board.name, color));
    setActiveKey(boardTabKey(board.id));
  }, [folderById]);

  const createBoardHere = useCallback((name?: string, folderId: string | null = null) => {
    const board: StudyBoard = {
      id: crypto.randomUUID(),
      name: name?.trim() || "Untitled board",
      folderId,
    };
    updateBoards((current) => [...current, board]);
    openBoardTab(board);
  }, [openBoardTab, updateBoards]);

  const activateTab = useCallback((key: string) => {
    setActiveKey(key);
    if (key === HOME_TAB_KEY) setBoardPreviewTick((tick) => tick + 1);
  }, []);

  const closeTab = useCallback((key: string) => {
    if (key === HOME_TAB_KEY) return;
    setTabs((current) => {
      const nextActive = neighborAfterClose(current, key, activeKey);
      const next = removeTab(current, key);
      setActiveKey(nextActive);
      if (nextActive === HOME_TAB_KEY || key.startsWith("board:")) {
        setBoardPreviewTick((tick) => tick + 1);
      }
      return next;
    });
  }, [activeKey]);

  const renameBoard = useCallback((id: string, nextName: string) => {
    const name = nextName.trim();
    if (!name) return;
    updateBoards((current) => current.map((board) => (board.id === id ? { ...board, name } : board)));
    const board = boards.find((item) => item.id === id);
    const color = board?.folderId ? folderById.get(board.folderId)?.color ?? null : null;
    setTabs((current) => syncBoardTabTitle(current, id, name, color));
  }, [boards, folderById, updateBoards]);

  useEffect(() => {
    persistBoards(boards);
  }, [boards]);

  useEffect(() => {
    setTabs((current) => {
      const stripped = stripNoteTabs(current);
      return ensureHomeFirst(stripped);
    });
    setActiveKey((current) => (current.startsWith("note:") ? HOME_TAB_KEY : current));
  }, [category]);

  useEffect(() => {
    if (!focusNoteId) return;
    openNoteTab(focusNoteId);
    onFocusHandled?.();
  }, [focusNoteId, onFocusHandled, openNoteTab]);

  // Only prune board tabs when a board is deleted. Note tabs stay until closed
  // explicitly — pruning against the live note list raced with create-and-open.
  useEffect(() => {
    const aliveBoards = new Set(boards.map((board) => board.id));
    setTabs((current) => {
      const next = current.filter((tab) => tab.kind !== "board" || aliveBoards.has(tab.id));
      return next.length === current.length ? current : ensureHomeFirst(next);
    });
    setActiveKey((current) => {
      if (current.startsWith("board:") && !aliveBoards.has(current.slice(6))) return HOME_TAB_KEY;
      return current;
    });
  }, [boards]);

  useEffect(() => {
    setTabs((current) =>
      current.map((tab) => {
        if (tab.kind !== "note") return tab;
        const note = notes.find((item) => item.id === tab.id);
        if (!note) return tab;
        const title = note.title?.trim() || "Untitled note";
        const color = folderColorForNote(note.folder_id);
        if (title === tab.title && color === tab.color) return tab;
        return { ...tab, title, color };
      }),
    );
  }, [folderColorForNote, notes]);

  useEffect(() => {
    setTabs((current) =>
      current.map((tab) => {
        if (tab.kind !== "board") return tab;
        const board = boards.find((item) => item.id === tab.id);
        if (!board) return tab;
        const color = board.folderId ? folderById.get(board.folderId)?.color ?? null : null;
        if (board.name === tab.title && color === tab.color) return tab;
        return { ...tab, title: board.name, color };
      }),
    );
  }, [boards, folderById]);

  const saveFolder = () => {
    if (!userId) {
      toast.error("Sign in to create a folder.");
      return;
    }
    const name = folderName.trim() || "Untitled folder";
    const color = folderColor || null;
    const request = folderEditId
      ? mutations.renameFolder.mutateAsync({ id: folderEditId, name, color })
      : mutations.createFolder.mutateAsync({ name, parentId: null, category, color });
    void request
      .then(() => { setFolderOpen(false); setFolderEditId(null); })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not save the folder.");
      });
  };

  const deleteResource = (item: StudyTrashItem) => {
    if (!userId) {
      toast.error("Sign in to delete.");
      return;
    }
    if (item.kind === "note") {
      closeTab(noteTabKey(item.id));
      mutations.deleteNote.mutate(item.id);
    }
    if (item.kind === "folder") mutations.deleteFolder.mutate(item.id);
  };

  const goHome = () => {
    setActiveKey(HOME_TAB_KEY);
    setBoardPreviewTick((tick) => tick + 1);
  };

  const openNewWorkspace = useCallback(() => {
    if (!userId) {
      toast.error("Sign in to create a note.");
      return;
    }
    setComposerFolderId(null);
  }, [userId]);

  const tabStrip = (
    <StudyTabStrip
      tabs={tabs}
      activeKey={activeKey}
      onActivate={activateTab}
      onClose={closeTab}
      onNewWorkspace={openNewWorkspace}
    />
  );

  return (
    <StudyTrashProvider visible={activeTab.kind === "note"} onDelete={deleteResource}>
      <div className="min-h-[calc(100vh-10rem)]">
        {tabStrip}

        {selectedNote ? (
          <div className="relative">
            <section className="study-glass relative mt-3 min-h-[calc(100dvh-11rem)] rounded-2xl p-5 pb-24 sm:p-6 sm:pb-28">
              <button
                type="button"
                onClick={goHome}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <StudyEditor
                key={selectedNote.id}
                noteId={selectedNote.id}
                title={selectedNote.title}
                content={selectedNote.content}
                trades={trades}
                playbooks={playbooks}
                onSave={async (input) => {
                  await mutations.saveNote.mutateAsync({ id: selectedNote.id, ...input });
                  if (input.title != null) {
                    setTabs((current) =>
                      syncNoteTabTitle(
                        current,
                        selectedNote.id,
                        input.title || "Untitled note",
                        folderColorForNote(selectedNote.folder_id),
                      ),
                    );
                  }
                }}
                onOpenJournal={onOpenJournal}
                onOpenPlaybook={onOpenPlaybook}
              />
            </section>
          </div>
        ) : null}

        {selectedBoard
          ? createPortal(
              <div className="fixed inset-0 z-[180] flex flex-col bg-background p-1.5 sm:p-2">
                <div className="shrink-0 px-0.5 pb-1.5">
                  <StudyTabStrip
                    tabs={tabs}
                    activeKey={activeKey}
                    onActivate={activateTab}
                    onClose={closeTab}
                    onNewWorkspace={openNewWorkspace}
                  />
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl">
                  <BoardCanvas
                    boardId={selectedBoard.id}
                    boardName={selectedBoard.name}
                    trades={trades}
                    playbooks={playbooks}
                    studyNotes={notes}
                    notebookEntries={notebookEntries}
                    onOpenJournal={onOpenJournal}
                    onOpenStudyNote={(id) => {
                      const note = notes.find((item) => item.id === id);
                      openNoteTab(id, note?.title);
                    }}
                    onRenameBoard={(nextName) => renameBoard(selectedBoard.id, nextName)}
                    onClose={goHome}
                  />
                </div>
              </div>,
              document.body,
            )
          : null}

        {activeTab.kind === "home" ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <StudyHome
                folders={folders}
                notes={notes}
                boards={boards}
                boardPreviewTick={boardPreviewTick}
                onBoardsChange={updateBoards}
                onOpenNote={openNoteTab}
                onOpenBoard={openBoardTab}
                onCreateNote={(folderId) => {
                  if (!userId) {
                    toast.error("Sign in to create a note.");
                    return;
                  }
                  setComposerFolderId(folderId);
                }}
                onMoveNote={(noteId, folderId) => {
                  if (!userId) {
                    toast.error("Sign in to move a note.");
                    return;
                  }
                  mutations.moveNote.mutate({ id: noteId, folderId });
                }}
                onRegisterCreateBoard={registerCreateBoard}
                onCreateFolder={() => { setFolderEditId(null); setFolderName("Untitled folder"); setFolderColor(""); setFolderOpen(true); }}
                onEditFolder={(folder) => { setFolderEditId(folder.id); setFolderName(folder.name); setFolderColor(folder.color ?? ""); setFolderOpen(true); }}
                onDeleteFolder={(folder) => {
                  if (!userId) {
                    toast.error("Sign in to delete a folder.");
                    return;
                  }
                  mutations.deleteFolder.mutate(folder.id);
                }}
              />
            </motion.div>
          </AnimatePresence>
        ) : null}

        {composerFolderId !== undefined ? (
          <StudyNoteComposer
            trades={trades}
            playbooks={playbooks}
            onClose={() => setComposerFolderId(undefined)}
            onCreateBoard={(name) => {
              setComposerFolderId(undefined);
              if (createBoardRef.current) createBoardRef.current(name);
              else createBoardHere(name, null);
            }}
            onCreate={(input) => {
              const folderId = composerFolderId ?? null;
              const title = input.title.trim() || "Untitled note";
              setComposerFolderId(undefined);
              void mutations.createNote.mutateAsync({ folderId, category, title, content: input.content })
                .then((id) => {
                  const optimistic: StudyNote = {
                    id,
                    user_id: userId ?? "",
                    folder_id: folderId,
                    title,
                    category,
                    content: input.content,
                    updated_at: new Date().toISOString(),
                  };
                  setOptimisticNotes((current) => [...current.filter((note) => note.id !== id), optimistic]);
                  setTabs((current) => upsertNoteTab(current, id, title, folderColorForNote(folderId)));
                  setActiveKey(noteTabKey(id));
                })
                .catch((error: unknown) => {
                  toast.error(error instanceof Error ? error.message : "Could not create the workspace.");
                });
            }}
          />
        ) : null}

        <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{folderEditId ? "Edit folder" : "New folder"}</DialogTitle></DialogHeader>
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name"
              className="mt-2"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                saveFolder();
              }}
            />
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Color</p>
              <div className="flex flex-wrap gap-2">
                {STUDY_FOLDER_COLORS.map((swatch) => {
                  const value = swatch.value;
                  const selectedColor = folderColor === value;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      aria-label={swatch.id}
                      onClick={() => setFolderColor(value)}
                      className={cn(
                        "h-7 w-7 rounded-full border border-border/60",
                        selectedColor && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background",
                      )}
                      style={{ background: value || "hsl(var(--primary))" }}
                    />
                  );
                })}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setFolderOpen(false)}>Cancel</Button>
              <Button type="button" onClick={saveFolder}>Save folder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StudyTrashProvider>
  );
}
