import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { studyDocPlainText, studyFolderColor } from "@/lib/studyArea";
import type { StudyFolder, StudyNote } from "@/hooks/useStudyArea";
import { Input } from "@/components/ui/input";

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

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
    >
      {children}
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
  onMoveNote,
}: {
  displayName?: string;
  folders: StudyFolder[];
  notes: StudyNote[];
  onOpenNote: (id: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onMoveNote?: (id: string, folderId: string | null) => void;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [inboxQuery, setInboxQuery] = useState("");
  const [draftSearch, setDraftSearch] = useState(false);
  const [inboxSearch, setInboxSearch] = useState(false);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const folderName = (id: string | null) => folders.find((folder) => folder.id === id)?.name;
  const drafts = useMemo(() => {
    const needle = draftQuery.trim().toLowerCase();
    return [...notes]
      .filter((note) => !needle || `${note.title} ${studyDocPlainText(note.content)}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [draftQuery, notes]);
  const inbox = useMemo(() => {
    const needle = inboxQuery.trim().toLowerCase();
    return notes
      .filter((note) => !note.folder_id)
      .filter((note) => !needle || `${note.title} ${studyDocPlainText(note.content)}`.toLowerCase().includes(needle));
  }, [inboxQuery, notes]);
  const folderCards = useMemo(
    () => [...folders].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [folders],
  );
  const visibleDrafts = showAllDrafts ? drafts : drafts.slice(0, 4);

  const toggleInbox = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(260px,22rem)_minmax(0,1fr)] lg:gap-10">
      <div className="space-y-8">
        <h2 className="text-[1.85rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.05rem]">
          {greetingLine(displayName)}
        </h2>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Recent drafts</h3>
            <div className="flex items-center">
              <IconButton label="Search drafts" onClick={() => setDraftSearch((open) => !open)}>
                <Search className="h-4 w-4" />
              </IconButton>
              <IconButton label="New draft" onClick={() => onCreateNote(null)}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          {draftSearch && (
            <Input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search drafts" className="mb-2 h-9 bg-background/50" />
          )}
          <div>
            {visibleDrafts.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">No drafts in this category yet.</p>
            ) : visibleDrafts.map((note) => {
              const preview = studyDocPlainText(note.content);
              const place = folderName(note.folder_id);
              return (
                <button
                  key={note.id}
                  type="button"
                  draggable={!!onMoveNote}
                  onDragStart={(event) => {
                    if (!onMoveNote) return;
                    const payload = JSON.stringify({ type: "note", id: note.id });
                    event.dataTransfer.setData("application/x-study-area", payload);
                    event.dataTransfer.setData("text/plain", payload);
                  }}
                  onClick={() => onOpenNote(note.id)}
                  className="flex w-full flex-col gap-0.5 py-2.5 text-left"
                >
                  <span className="truncate text-sm font-medium">{note.title || "Untitled note"}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[place, preview].filter(Boolean).join("  /  ") || "Empty note"}
                  </span>
                </button>
              );
            })}
          </div>
          {drafts.length > 4 && (
            <button type="button" onClick={() => setShowAllDrafts((open) => !open)} className="mt-1 text-sm text-muted-foreground hover:text-foreground">
              {showAllDrafts ? "See less" : "See more"}
            </button>
          )}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Thought inbox</h3>
            <div className="flex items-center">
              <IconButton label="Search inbox" onClick={() => setInboxSearch((open) => !open)}>
                <Search className="h-4 w-4" />
              </IconButton>
              <IconButton label="New inbox note" onClick={() => onCreateNote(null)}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" onClick={() => setExpanded(new Set(inbox.map((note) => note.id)))} className="hover:text-foreground">
              Expand all
            </button>
            <span>{inbox.length} unfiled</span>
          </div>
          {inboxSearch && (
            <Input value={inboxQuery} onChange={(event) => setInboxQuery(event.target.value)} placeholder="Search inbox" className="mb-3 h-9 bg-background/50" />
          )}
          <div className="space-y-2">
            {inbox.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-sm text-muted-foreground">
                Unfiled notes show up here.
              </p>
            ) : inbox.map((note) => {
              const open = expanded.has(note.id);
              const preview = studyDocPlainText(note.content);
              return (
                <div key={note.id} className="study-glass rounded-xl">
                  <button type="button" onClick={() => toggleInbox(note.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border border-border", open && "border-primary bg-primary/15")}>
                      {open && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{note.title || "Untitled note"}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <button type="button" onClick={() => onOpenNote(note.id)} className="block w-full px-9 pb-3 text-left text-xs leading-5 text-muted-foreground">
                          {preview || "Empty note"}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {folderCards.length === 0 ? (
          <button
            type="button"
            onClick={onCreateFolder}
            className="study-glass flex min-h-52 items-center justify-center rounded-2xl border-dashed px-5 py-8 text-sm text-muted-foreground"
          >
            Create a folder
          </button>
        ) : folderCards.map((folder) => {
          const folderNotes = notes
            .filter((note) => note.folder_id === folder.id)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          const latest = folderNotes[0]?.updated_at ?? folder.updated_at;
          const color = studyFolderColor(folder.color);
          const sheets = folderNotes.slice(0, 2);
          return (
            <article
              key={folder.id}
              className="study-glass rounded-2xl p-4"
              onDragOver={(event) => {
                if (!onMoveNote) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!onMoveNote) return;
                event.preventDefault();
                try {
                  const raw = event.dataTransfer.getData("application/x-study-area") || event.dataTransfer.getData("text/plain");
                  const payload = JSON.parse(raw) as { type?: string; id?: string };
                  if (payload.type === "note" && payload.id) onMoveNote(payload.id, folder.id);
                } catch {
                  // Ignore drops that are not study notes.
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <h4 className="truncate text-base font-semibold tracking-tight">{folder.name}</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{editedLabel(latest)}</p>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-background/55 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {folderNotes.length}
                  <ChevronDown className="h-3 w-3" />
                </span>
              </div>
              <div className="study-folder-well mt-4">
                <div className="study-folder-sheet study-folder-sheet--ghost" style={{ top: "2.85rem", transform: "rotate(1.4deg)" }} />
                <div className="study-folder-sheet study-folder-sheet--ghost" style={{ top: "1.55rem", transform: "rotate(-0.6deg)", opacity: 0.75 }} />
                {sheets.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onCreateNote(folder.id)}
                    className="study-folder-sheet study-folder-sheet--note flex items-center justify-center text-xs text-muted-foreground"
                    style={{ top: "0.7rem" }}
                  >
                    Add a note
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenNote(sheets[0].id)}
                    className="study-folder-sheet study-folder-sheet--note text-left"
                    style={{ top: "0.7rem" }}
                  >
                    <p className="truncate text-xs font-medium">{sheets[0].title || "Untitled note"}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {studyDocPlainText(sheets[0].content) || "Empty note"}
                    </p>
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {folderCards.length > 0 && (
          <button
            type="button"
            onClick={onCreateFolder}
            className="study-glass flex min-h-52 items-center justify-center rounded-2xl border-dashed px-5 py-8 text-sm text-muted-foreground"
          >
            Create a folder
          </button>
        )}
      </div>
    </div>
  );
}
