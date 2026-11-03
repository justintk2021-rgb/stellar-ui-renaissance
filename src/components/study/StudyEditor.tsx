import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import type { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isUnjournaledTrade } from "@/lib/notifications";
import { matchSlashTrade, parseYouTubeId, splitStudyTrades } from "@/lib/studyArea";
import { StudyTradeCard } from "./StudyTradeCard";
import { StudyEditorDataProvider, type StudyPlaybook } from "./studyEditorData";
import { StudyTradeNode, StudyYoutubeNode } from "./studyNodes";
import { Bold, Heading2, Italic, List, ListOrdered, Plus } from "lucide-react";

interface StudyEditorProps {
  noteId: string;
  title: string;
  content: JSONContent;
  trades: Trade[];
  playbooks: StudyPlaybook[];
  onSave: (input: { title: string; content: JSONContent; tradeIds: string[] }) => Promise<void>;
  onOpenJournal?: (tradeId: string) => void;
  onOpenPlaybook?: (playbookId: string | null) => void;
}

export function StudyEditor({ noteId, title, content, trades, playbooks, onSave, onOpenJournal, onOpenPlaybook }: StudyEditorProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [status, setStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [slash, setSlash] = useState<{ query: string; from: number; to: number; x: number; y: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const opened = useRef(splitStudyTrades(content));
  const [tradeIds, setTradeIds] = useState<string[]>(opened.current.tradeIds);
  const tradeIdsRef = useRef(opened.current.tradeIds);
  const [addingTrade, setAddingTrade] = useState(false);
  const [tradeQuery, setTradeQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const dirtyRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your study note. Type /trade to insert a journal trade." }),
      StudyTradeNode,
      StudyYoutubeNode,
    ],
    content: opened.current.doc,
    editorProps: {
      attributes: {
        class: "study-prose min-h-[280px] px-1 py-2 text-[15px] leading-7 outline-none",
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
        const videoId = parseYouTubeId(text);
        if (!videoId) return false;
        const nodeType = view.state.schema.nodes.studyYoutube;
        if (!nodeType) return false;
        event.preventDefault();
        view.dispatch(view.state.tr.replaceSelectionWith(nodeType.create({ videoId })));
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      dirtyRef.current = true;
      setRevision((value) => value + 1);
      const { from } = current.state.selection;
      const before = current.state.doc.textBetween(Math.max(0, from - 80), from, "\n", "\n");
      const match = matchSlashTrade(before);
      if (!match) {
        setSlash(null);
        return;
      }
      const coords = current.view.coordsAtPos(from);
      setSlash({
        query: match.query,
        from: from - (before.length - match.start),
        to: from,
        x: Math.min(coords.left, window.innerWidth - 420),
        y: coords.bottom + 8,
      });
    },
  }, [noteId]);

  useEffect(() => {
    dirtyRef.current = false;
    setDraftTitle(title);
    setStatus("idle");
    setSlash(null);
  }, [noteId, title]);

  useEffect(() => {
    if (!editor || !dirtyRef.current) return;
    dirtyRef.current = false;
    const snapshotTitle = draftTitle;
    const snapshot = editor.getJSON();
    const prose = (snapshot.content ?? []).filter((node) => node.type !== "studyTrade");
    const saved = {
      ...snapshot,
      content: [
        ...(prose.length ? prose : [{ type: "paragraph" }]),
        ...tradeIdsRef.current.map((tradeId) => ({ type: "studyTrade", attrs: { tradeId } })),
      ],
    };
    const handle = window.setTimeout(() => {
      setStatus("saving");
      void onSaveRef.current({ title: snapshotTitle, content: saved, tradeIds: tradeIdsRef.current })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("idle"));
    }, 700);
    return () => window.clearTimeout(handle);
  }, [draftTitle, editor, noteId, revision]);

  const results = useMemo(() => {
    const needle = slash?.query.trim().toLowerCase() ?? "";
    const ranked = [...trades].sort((a, b) => (b.openTime || b.date).localeCompare(a.openTime || a.date));
    if (!needle) return ranked.slice(0, 12);
    return ranked.filter((trade) => {
      const playbook = playbooks.find((item) => item.id === trade.checklistId)?.name ?? "";
      return [trade.pair, trade.direction, trade.date, playbook].join(" ").toLowerCase().includes(needle);
    }).slice(0, 12);
  }, [playbooks, slash?.query, trades]);

  const rememberTrade = (tradeId: string) => {
    if (slash && editor) editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
    setSlash(null);
    setAddingTrade(false);
    setTradeQuery("");
    if (tradeIdsRef.current.includes(tradeId)) return;
    const next = [...tradeIdsRef.current, tradeId];
    tradeIdsRef.current = next;
    setTradeIds(next);
    dirtyRef.current = true;
    setRevision((value) => value + 1);
  };

  const journalTrades = useMemo(() => {
    const needle = tradeQuery.trim().toLowerCase();
    const source = trades.some((trade) => !isUnjournaledTrade(trade) || trade.checklistId)
      ? trades.filter((trade) => !isUnjournaledTrade(trade) || trade.checklistId)
      : trades;
    return [...source]
      .filter((trade) => !tradeIds.includes(trade.id))
      .sort((a, b) => (b.openTime || b.date).localeCompare(a.openTime || a.date))
      .filter((trade) => {
        if (!needle) return true;
        const playbook = playbooks.find((item) => item.id === trade.checklistId)?.name ?? "";
        return [trade.pair, trade.direction, trade.date, playbook].join(" ").toLowerCase().includes(needle);
      })
      .slice(0, 8);
  }, [playbooks, tradeIds, tradeQuery, trades]);

  return (
    <StudyEditorDataProvider value={{ trades, playbooks, onOpenJournal, onOpenPlaybook }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Study note"}
          </p>
          <div className="flex w-full max-w-xl flex-col items-end gap-3">
            <Popover open={addingTrade} onOpenChange={setAddingTrade}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-expanded={addingTrade}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
                >
                  <Plus className="h-4 w-4" />
                  Add trade
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={10}
                collisionPadding={16}
                className="w-[min(24rem,calc(100vw-2rem))] p-4 liquid-glass projection-popover shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none"
              >
                <p className="mb-3 text-sm font-medium text-muted-foreground">Journaled trades</p>
                <input
                  value={tradeQuery}
                  onChange={(event) => setTradeQuery(event.target.value)}
                  placeholder="Search journal trades or playbooks"
                  className="mb-2 h-10 w-full rounded-xl border border-border/50 bg-background/70 px-3 text-sm outline-none focus:border-primary/40"
                />
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {journalTrades.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-muted-foreground">No journaled trades match.</p>
                  ) : journalTrades.map((trade) => (
                    <StudyTradeCard
                      key={trade.id}
                      tradeId={trade.id}
                      trades={trades}
                      playbooks={playbooks}
                      onSelect={() => rememberTrade(trade.id)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {tradeIds.length > 0 ? (
              <div className="w-full space-y-2">
                {tradeIds.map((tradeId) => (
                  <StudyTradeCard
                    key={tradeId}
                    tradeId={tradeId}
                    trades={trades}
                    playbooks={playbooks}
                    onOpenJournal={onOpenJournal}
                    onOpenPlaybook={onOpenPlaybook}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Input
          value={draftTitle}
          onChange={(event) => {
            dirtyRef.current = true;
            setRevision((value) => value + 1);
            setDraftTitle(event.target.value);
          }}
          className="h-12 border-0 bg-transparent px-1 text-2xl font-semibold shadow-none focus-visible:ring-0"
          aria-label="Note title"
        />
        <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
          <span className="ml-2 self-center text-[11px] text-muted-foreground">Type /trade or paste a YouTube link.</span>
        </div>
        <EditorContent
          editor={editor}
          onKeyDown={(event) => {
            if (!slash) return;
            if (event.key === "Escape") {
              event.preventDefault();
              setSlash(null);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setSlashIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSlashIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[slashIndex]) {
              event.preventDefault();
              rememberTrade(results[slashIndex].id);
            }
          }}
        />
        {slash && (
          <div
            className="fixed z-[80] w-[min(420px,calc(100vw-24px))] rounded-2xl border border-border/50 bg-popover/95 p-2 shadow-2xl backdrop-blur-md"
            style={{ left: slash.x, top: slash.y }}
          >
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {slash.query ? `Trades matching “${slash.query}”` : "Search journal trades"}
            </p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">No trades match.</p>
              ) : results.map((trade, index) => (
                <StudyTradeCard
                  key={trade.id}
                  tradeId={trade.id}
                  trades={trades}
                  playbooks={playbooks}
                  active={index === slashIndex}
                  onSelect={() => rememberTrade(trade.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </StudyEditorDataProvider>
  );
}
