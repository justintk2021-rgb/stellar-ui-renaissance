import { useEffect, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type { Trade } from "@/types/trade";
import { useChecklists } from "@/hooks/useChecklists";
import { useStudyMutations, useStudyTree, type StudyFolder, type StudyNote } from "@/hooks/useStudyArea";
import { STUDY_FOLDER_COLORS, type StudyCategory } from "@/lib/studyArea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudyEditor } from "./StudyEditor";
import { StudyHome } from "./StudyHome";
import { StudyNoteComposer } from "./StudyNoteComposer";
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
  focusNoteId,
  onFocusHandled,
  category,
  displayName,
  onOpenJournal,
  onOpenPlaybook,
}: {
  userId?: string;
  trades: Trade[];
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [composerFolderId, setComposerFolderId] = useState<string | null | undefined>(undefined);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("");
  const liveFolders = (tree.data?.folders ?? []).filter((folder) => folder.category === category);
  const liveNotes = (tree.data?.notes ?? []).filter((note) => note.category === category);
  const preview = liveFolders.length === 0 && liveNotes.length === 0 ? marketingPreviewTree(category) : null;
  const folders = preview?.folders ?? liveFolders;
  const notes = preview?.notes ?? liveNotes;
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
            onOpenJournal={onOpenJournal}
            onOpenPlaybook={onOpenPlaybook}
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
                setComposerFolderId(folderId);
              }}
              onCreateFolder={() => { setFolderName("Untitled folder"); setFolderColor(""); setFolderOpen(true); }}
            />
          </motion.div>
        </AnimatePresence>
      )}
      {composerFolderId !== undefined ? (
        <StudyNoteComposer
          trades={trades}
          playbooks={playbooks}
          onClose={() => setComposerFolderId(undefined)}
          onCreate={(input) => {
            const folderId = composerFolderId ?? null;
            setComposerFolderId(undefined);
            void mutations.createNote.mutateAsync({ folderId, category, title: input.title, content: input.content })
              .then(setSelectedId)
              .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : "Could not create the note.");
              });
          }}
        />
      ) : null}
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
