import { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useStudyMutations, useStudyTree } from "@/hooks/useStudyArea";
import { AnimatePresence, motion } from "@/lib/motion";
import type { StudyCategory } from "@/lib/studyArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudyEditor } from "./StudyEditor";
import { StudyHome } from "./StudyHome";
import { ArrowLeft } from "lucide-react";

export function StudyArea({
  userId,
  trades,
  focusNoteId,
  onFocusHandled,
  category,
  displayName,
}: {
  userId?: string;
  trades: Trade[];
  focusNoteId?: string | null;
  onFocusHandled?: () => void;
  category: StudyCategory;
  displayName?: string;
}) {
  const tree = useStudyTree(userId);
  const mutations = useStudyMutations(userId);
  const { checklists } = useChecklists();
  const playbooks = useMemo(() => checklists.map((item) => ({ id: item.id, name: item.name })), [checklists]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const folders = (tree.data?.folders ?? []).filter((folder) => folder.category === category);
  const notes = (tree.data?.notes ?? []).filter((note) => note.category === category);
  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const currentFolder = selected?.folder_id ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [category]);

  useEffect(() => {
    if (!focusNoteId) return;
    setSelectedId(focusNoteId);
    onFocusHandled?.();
  }, [focusNoteId, onFocusHandled]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={category}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.985 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-[calc(100vh-10rem)]"
      >
      {selected && userId ? (
        <section className="notebook-panel min-h-[520px] rounded-2xl p-5 sm:p-6">
          <button type="button" onClick={() => setSelectedId(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <StudyEditor
            key={selected.id}
            noteId={selected.id}
            title={selected.title}
            content={selected.content}
            trades={trades}
            playbooks={playbooks}
            onSave={async (input) => { await mutations.saveNote.mutateAsync({ id: selected.id, ...input }); }}
          />
        </section>
      ) : tree.isError ? (
        <p className="text-sm text-muted-foreground">Study Area is not available until the new tables are created.</p>
      ) : (
        <StudyHome
          displayName={displayName}
          folders={folders}
          notes={notes}
          onOpenNote={setSelectedId}
          onCreateNote={(folderId) => { if (!userId) return; void mutations.createNote.mutateAsync({ folderId, category }).then(setSelectedId); }}
          onCreateFolder={() => { setRenameId(null); setFolderName(""); setFolderOpen(true); }}
          onMoveNote={(id, folderId) => mutations.moveNote.mutate({ id, folderId })}
        />
      )}
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
              else mutations.createFolder.mutate({ name, parentId: currentFolder, category });
              setFolderOpen(false);
            }}>Save folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </motion.div>
    </AnimatePresence>
  );
}
