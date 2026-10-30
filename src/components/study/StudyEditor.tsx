import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import type { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchSlashTrade, parseYouTubeId, tradeIdsInDoc } from "@/lib/studyArea";
import { StudyTradeCard } from "./StudyTradeCard";
import { StudyEditorDataProvider, type StudyPlaybook } from "./studyEditorData";
import { StudyTradeNode, StudyYoutubeNode } from "./studyNodes";
import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";

interface StudyEditorProps {
  noteId: string;
  title: string;
  content: JSONContent;
  trades: Trade[];
  playbooks: StudyPlaybook[];
  onSave: (input: { title: string; content: JSONContent }) => Promise<void>;
}

export function StudyEditor({ noteId, title, content, trades, playbooks, onSave }: StudyEditorProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [status, setStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [slash, setSlash] = useState<{ query: string; from: number; to: number; x: number; y: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [tradeIds, setTradeIds] = useState<string[]>(() => tradeIdsInDoc(content));
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
    content,
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
      const json = current.getJSON();
      setTradeIds(tradeIdsInDoc(json));
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
    const handle = window.setTimeout(() => {
      setStatus("saving");
      void onSaveRef.current({ title: snapshotTitle, content: snapshot })
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

  const insertTrade = (tradeId: string) => {
    if (!editor || !slash) return;
    editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).insertContent({
      type: "studyTrade",
      attrs: { tradeId },
    }).run();
    setSlash(null);
  };

  return (
    <StudyEditorDataProvider value={{ trades, playbooks }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Study note"}
          </p>
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
              insertTrade(results[slashIndex].id);
            }
          }}
        />
        <div className="mt-6 border-t border-border/40 pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Trades in this note</p>
          {tradeIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No journal trades yet.</p>
          ) : (
            <div className="space-y-2">
              {tradeIds.map((tradeId) => (
                <StudyTradeCard key={tradeId} tradeId={tradeId} trades={trades} playbooks={playbooks} />
              ))}
            </div>
          )}
        </div>
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
                  onSelect={() => insertTrade(trade.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </StudyEditorDataProvider>
  );
}
