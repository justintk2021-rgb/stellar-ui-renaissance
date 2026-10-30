import { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useStudyMutations, useStudyTree } from "@/hooks/useStudyArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudyFolderTree } from "./StudyFolderTree";
import { StudyEditor } from "./StudyEditor";
import { FolderPlus, Plus } from "lucide-react";

export function StudyArea({
  userId,
  trades,
  focusNoteId,
  onFocusHandled,
}: {
  userId?: string;
  trades: Trade[];
  focusNoteId?: string | null;
  onFocusHandled?: () => void;
}) {
  const tree = useStudyTree(userId);
  const mutations = useStudyMutations(userId);
  const { checklists } = useChecklists();
  const playbooks = useMemo(() => checklists.map((item) => ({ id: item.id, name: item.name })), [checklists]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const folders = tree.data?.folders ?? [];
  const notes = tree.data?.notes ?? [];
  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const currentFolder = selected?.folder_id ?? null;

  useEffect(() => {
    if (!focusNoteId) return;
    setSelectedId(focusNoteId);
    onFocusHandled?.();
  }, [focusNoteId, onFocusHandled]);

  return (
    <div className="grid min-h-[calc(100vh-10rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="notebook-panel flex flex-col rounded-2xl p-4">
        <div className="mb-3 flex gap-2">
          <Button type="button" className="flex-1" onClick={() => { if (!userId) return; void mutations.createNote.mutateAsync(currentFolder).then(setSelectedId); }}>
            <Plus className="h-4 w-4" />
            New note
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="New folder" onClick={() => { setRenameId(null); setFolderName(""); setFolderOpen(true); }}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
        {tree.isError ? (
          <p className="text-sm text-muted-foreground">Study Area is not available until the new tables are created.</p>
        ) : (
          <StudyFolderTree
            folders={folders}
            notes={notes}
            selectedNoteId={selectedId}
            onSelectNote={setSelectedId}
            onMoveNote={(id, folderId) => mutations.moveNote.mutate({ id, folderId })}
            onMoveFolder={(id, parentId) => mutations.moveFolder.mutate({ id, parentId })}
            onRenameFolder={(folder) => { setRenameId(folder.id); setFolderName(folder.name); setFolderOpen(true); }}
            onDeleteFolder={(folder) => mutations.deleteFolder.mutate(folder.id)}
          />
        )}
      </aside>
      <section className="notebook-panel min-h-[520px] rounded-2xl p-5 sm:p-6">
        {selected && userId ? (
          <StudyEditor
            key={selected.id}
            noteId={selected.id}
            title={selected.title}
            content={selected.content}
            trades={trades}
            playbooks={playbooks}
            onSave={async (input) => { await mutations.saveNote.mutateAsync({ id: selected.id, ...input }); }}
          />
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg font-semibold">Study Area</p>
            <p className="max-w-md text-sm text-muted-foreground">Nested folders, an autosaving note, YouTube embeds, and live trade cards.</p>
            <Button type="button" onClick={() => { if (!userId) return; void mutations.createNote.mutateAsync(null).then(setSelectedId); }}>
              <Plus className="h-4 w-4" />
              New note
            </Button>
          </div>
        )}
      </section>
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{renameId ? "Rename folder" : "New folder"}</DialogTitle></DialogHeader>
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" className="mt-2" />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setFolderOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => {
              const name = folderName.trim();
              if (!name || !userId) return;
              if (renameId) mutations.renameFolder.mutate({ id: renameId, name });
              else mutations.createFolder.mutate({ name, parentId: currentFolder });
              setFolderOpen(false);
            }}>Save folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
