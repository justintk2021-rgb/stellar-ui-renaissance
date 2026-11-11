import { RotateCcw, Trash2 } from "lucide-react";
import type { StudyNote } from "@/hooks/useStudyArea";
import { studyDocPlainText } from "@/lib/studyArea";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StudyBinDialog({
  open,
  onOpenChange,
  notes,
  folderNameFor,
  onRestore,
  onDeleteForever,
  onEmpty,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: StudyNote[];
  folderNameFor: (folderId: string | null) => string;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onEmpty: () => void;
}) {
  const items = [...notes].sort((a, b) =>
    (b.deletedAt || b.updated_at).localeCompare(a.deletedAt || a.updated_at),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(36rem,85vh)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/40 bg-card/80 p-0 backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border/20 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/60">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </span>
            Bin
            {items.length > 0 ? (
              <span className="rounded-full bg-muted/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {items.length}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Recover notes or delete them permanently.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <Trash2 className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium text-foreground/80">Bin is empty</p>
              <p className="text-xs">Deleted notes will show up here.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((note) => {
                const preview = studyDocPlainText(note.content);
                return (
                  <li
                    key={note.id}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {note.title || "Untitled note"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {preview || "No content"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {folderNameFor(note.folder_id)}
                        {note.deletedAt
                          ? ` · deleted ${new Date(note.deletedAt).toLocaleDateString()}`
                          : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 border-0 px-2 text-xs text-foreground hover:bg-muted/60"
                        onClick={() => onRestore(note.id)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Recover
                      </Button>
                      <ConfirmDialog
                        title="Delete permanently?"
                        description={`“${note.title || "Untitled note"}” will be removed forever. This cannot be undone.`}
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => onDeleteForever(note.id)}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 border-0 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                          </Button>
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border/20 px-5 py-3 sm:justify-between">
          <Button type="button" variant="ghost" className="border-0" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {items.length > 0 ? (
            <ConfirmDialog
              title="Empty bin?"
              description={`Permanently delete all ${items.length} note${items.length === 1 ? "" : "s"} in the bin? This cannot be undone.`}
              confirmLabel="Empty bin"
              variant="destructive"
              onConfirm={onEmpty}
              trigger={
                <Button type="button" variant="destructive" className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Empty bin
                </Button>
              }
            />
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
