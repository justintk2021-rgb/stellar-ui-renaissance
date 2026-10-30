import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyDocPlainText, studyFolderColor } from "@/lib/studyArea";
import type { StudyFolder, StudyNote } from "@/hooks/useStudyArea";

function greetingLine(name?: string): string {
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(" ")[0];
  return first ? `${greeting}, ${first}` : greeting;
}

function editedLabel(iso?: string): string {
  if (!iso) return "No notes yet";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Edited ${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Edited ${days} day${days === 1 ? "" : "s"} ago`;
}

function NoteRow({
  note,
  detail,
  onOpen,
}: {
  note: StudyNote;
  detail?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      className="flex w-full items-baseline justify-between gap-4 py-2.5 text-left transition-colors hover:text-foreground"
    >
      <span className="min-w-0 truncate text-sm font-medium text-foreground/90">
        {note.title || "Untitled note"}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {detail ?? editedLabel(note.updated_at).replace(/^Edited /, "")}
      </span>
    </button>
  );
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
  const drafts = useMemo(
    () => [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8),
    [notes],
  );
  const inbox = useMemo(() => notes.filter((note) => !note.folder_id), [notes]);
  const folderCards = useMemo(
    () => [...folders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [folders],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(240px,20rem)_minmax(0,1fr)] lg:gap-12">
      <div className="space-y-10">
        <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
          {greetingLine(displayName)}
        </h2>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent drafts</h3>
            <button
              type="button"
              onClick={() => onCreateNote(null)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {drafts.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">No drafts in this category yet.</p>
            ) : drafts.map((note) => (
              <NoteRow key={note.id} note={note} onOpen={onOpenNote} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inbox</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{inbox.length}</span>
          </div>
          <div className="divide-y divide-border/40">
            {inbox.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">Notes that are not in a folder show up here.</p>
            ) : inbox.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                detail={studyDocPlainText(note.content).slice(0, 42) || "Empty"}
                onOpen={onOpenNote}
              />
            ))}
          </div>
        </section>
      </div>

      <div>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Folders</h3>
          <button
            type="button"
            onClick={onCreateFolder}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New folder
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {folderCards.length === 0 ? (
            <button
              type="button"
              onClick={onCreateFolder}
              className="study-glass flex min-h-44 items-center justify-center rounded-2xl border-dashed px-5 py-8 text-sm text-muted-foreground"
            >
              Create a folder
            </button>
          ) : folderCards.map((folder) => {
            const folderNotes = notes
              .filter((note) => note.folder_id === folder.id)
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
            const latest = folderNotes[0]?.updated_at ?? folder.updated_at;
            const color = studyFolderColor(folder.color);
            return (
              <article
                key={folder.id}
                className="study-glass relative overflow-hidden rounded-2xl p-4 sm:p-5"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px]"
                  style={{ background: color }}
                />
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <h4 className="truncate text-[15px] font-semibold tracking-tight">{folder.name}</h4>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{editedLabel(latest)}</p>
                  </div>
                  <span className="rounded-full bg-background/50 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {folderNotes.length}
                  </span>
                </div>
                <ul className={cn("mt-4 space-y-0.5 pl-1", folderNotes.length === 0 && "mt-6")}>
                  {folderNotes.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No notes in this folder</li>
                  ) : folderNotes.map((note) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => onOpenNote(note.id)}
                        className="block w-full truncate py-1 text-left text-sm text-foreground/85 transition-colors hover:text-foreground"
                      >
                        {note.title || "Untitled note"}
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
