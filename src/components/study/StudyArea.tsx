import { useEffect, useMemo, useState } from "react";
import type { Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useStudyMutations, useStudyTree } from "@/hooks/useStudyArea";
import { STUDY_FOLDER_COLORS, type StudyCategory } from "@/lib/studyArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudyEditor } from "./StudyEditor";
import { StudyHome } from "./StudyHome";
import { AnimatePresence, motion } from "@/lib/motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [folderColor, setFolderColor] = useState("");
  const folders = (tree.data?.folders ?? []).filter((folder) => folder.category === category);
  const notes = (tree.data?.notes ?? []).filter((note) => note.category === category);
  const selected = notes.find((note) => note.id === selectedId) ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [category]);

  useEffect(() => {
    if (!focusNoteId) return;
    setSelectedId(focusNoteId);
    onFocusHandled?.();
  }, [focusNoteId, onFocusHandled]);

  const saveFolder = () => {
    if (!userId) {
      toast.error("Sign in to create a folder.");
      return;
    }
    const name = folderName.trim() || "Untitled folder";
    void mutations.createFolder.mutateAsync({ name, parentId: null, category, color: folderColor || null })
      .then(() => setFolderOpen(false))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not create the folder.");
      });
  };

  return (
    <div className="min-h-[calc(100vh-10rem)]">
      {selected ? (
        <section className="study-glass min-h-[520px] rounded-2xl p-5 sm:p-6">
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
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <StudyHome
              displayName={displayName}
              folders={folders}
              notes={notes}
              onOpenNote={setSelectedId}
              onCreateNote={(folderId) => {
                if (!userId) {
                  toast.error("Sign in to create a note.");
                  return;
                }
                void mutations.createNote.mutateAsync({ folderId, category })
                  .then(setSelectedId)
                  .catch((error: unknown) => {
                    toast.error(error instanceof Error ? error.message : "Could not create the note.");
                  });
              }}
              onCreateFolder={() => { setFolderName("Untitled folder"); setFolderColor(""); setFolderOpen(true); }}
              onMoveNote={(id, folderId) => {
                if (!userId) return;
                mutations.moveNote.mutate({ id, folderId });
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
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
  );
}
