import { useMemo, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { studyDocPlainText } from "@/lib/studyArea";
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
  onMoveNote: (id: string, folderId: string | null) => void;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [inboxQuery, setInboxQuery] = useState("");
  const [draftSearch, setDraftSearch] = useState(false);
  const [inboxSearch, setInboxSearch] = useState(false);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const folderName = (id: string | null) => folders.find((folder) => folder.id === id)?.name;
  const recent = useMemo(() => {
    const needle = draftQuery.trim().toLowerCase();
    return [...notes]
      .filter((note) => !activeFolderId || note.folder_id === activeFolderId)
      .filter((note) => !needle || `${note.title} ${studyDocPlainText(note.content)}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [activeFolderId, draftQuery, notes]);
  const inbox = useMemo(() => {
    const needle = inboxQuery.trim().toLowerCase();
    return notes
      .filter((note) => !note.folder_id)
      .filter((note) => !needle || `${note.title} ${studyDocPlainText(note.content)}`.toLowerCase().includes(needle));
  }, [inboxQuery, notes]);
  const visibleDrafts = showAllDrafts ? recent : recent.slice(0, 4);
  const greetingLineText = greetingLine(displayName);

  const toggleInbox = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{greetingLineText}</h2>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Recent drafts</h3>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Search drafts" onClick={() => setDraftSearch((open) => !open)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                <Search className="h-4 w-4" />
              </button>
              <button type="button" aria-label="New draft" onClick={() => onCreateNote(activeFolderId)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {draftSearch && (
            <Input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Search drafts" className="mb-3 h-9 bg-background/50" />
          )}
          <div className="divide-y divide-border/40">
            {visibleDrafts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No drafts in this category yet.</p>
            ) : visibleDrafts.map((note) => (
              <button
                key={note.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  const payload = JSON.stringify({ type: "note", id: note.id });
                  event.dataTransfer.setData("application/x-study-area", payload);
                  event.dataTransfer.setData("text/plain", payload);
                }}
                onClick={() => onOpenNote(note.id)}
                className="flex w-full flex-col gap-1 py-3 text-left hover:bg-muted/30"
              >
                <span className="truncate text-sm font-medium">{note.title || "Untitled note"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[folderName(note.folder_id), studyDocPlainText(note.content)].filter(Boolean).join("  /  ") || "Empty note"}
                </span>
              </button>
            ))}
          </div>
          {recent.length > 4 && (
            <button type="button" onClick={() => setShowAllDrafts((open) => !open)} className="mt-2 text-sm text-muted-foreground hover:text-foreground">
              {showAllDrafts ? "See less" : "See more"}
            </button>
          )}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Thought inbox</h3>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Search inbox" onClick={() => setInboxSearch((open) => !open)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                <Search className="h-4 w-4" />
              </button>
              <button type="button" aria-label="New inbox note" onClick={() => onCreateNote(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" onClick={() => setExpanded(new Set(inbox.map((note) => note.id)))} className="hover:text-foreground">Expand all</button>
            <span>{inbox.length} unfiled</span>
          </div>
          {inboxSearch && (
            <Input value={inboxQuery} onChange={(event) => setInboxQuery(event.target.value)} placeholder="Search inbox" className="mb-3 h-9 bg-background/50" />
          )}
          <div className="space-y-2">
            {inbox.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">Unfiled notes show up here.</p>
            ) : inbox.map((note) => {
              const open = expanded.has(note.id);
              const preview = studyDocPlainText(note.content);
              return (
                <div key={note.id} className="rounded-xl border border-border/50 bg-card/50">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {folders.length === 0 ? (
          <button type="button" onClick={onCreateFolder} className="notebook-panel flex min-h-52 items-center justify-center rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Create a folder
          </button>
        ) : folders.map((folder) => {
          const folderNotes = notes.filter((note) => note.folder_id === folder.id);
          const latest = [...folderNotes].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
          const sheets = folderNotes.slice(0, 2);
          const selected = activeFolderId === folder.id;
          return (
            <div
              key={folder.id}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
              onDrop={(event) => {
                event.preventDefault();
                try {
                  const raw = event.dataTransfer.getData("application/x-study-area") || event.dataTransfer.getData("text/plain");
                  const payload = JSON.parse(raw) as { type?: string; id?: string };
                  if (payload.type === "note" && payload.id) onMoveNote(payload.id, folder.id);
                } catch {
                  // Ignore drops that are not study notes.
                }
              }}
              className={cn(
                "notebook-panel rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5",
                selected && "ring-2 ring-primary/40",
              )}
            >
              <button type="button" onClick={() => setActiveFolderId(selected ? null : folder.id)} className="flex w-full items-start justify-between gap-3 text-left">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{folder.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{editedLabel(latest?.updated_at)}</p>
                </div>
                <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{folderNotes.length}</span>
              </button>
              <div className="mt-4 space-y-2 rounded-xl border border-border/40 bg-background/40 p-3">
                {sheets.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop a draft here</p>
                ) : sheets.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => onOpenNote(note.id)}
                    className="block w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-left shadow-sm"
                  >
                    <p className="truncate text-xs font-medium">{note.title || "Untitled note"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{studyDocPlainText(note.content) || "Empty note"}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
