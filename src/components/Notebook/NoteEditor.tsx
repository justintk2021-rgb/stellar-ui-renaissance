import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TRADE_EMBED_CLASS,
  filterTradesForSlash,
  matchSlashTrade,
  parseYouTubeId,
  replaceYouTubeUrlsWithEmbeds,
  serializeNoteHtml,
  tradeEmbedHtml,
  youtubeEmbedHtml,
} from "@/lib/studyNotes";
import { LiveTradeCard, type PlaybookLookup } from "./LiveTradeCard";
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Search,
  Underline,
} from "lucide-react";

interface NoteEditorProps {
  noteId: string;
  title: string;
  content: string;
  trades: Trade[];
  playbooks: PlaybookLookup[];
  readOnly?: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (html: string) => void;
}

function caretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const rects = range.getClientRects();
  if (rects.length > 0) return rects[0];
  const span = document.createElement("span");
  span.textContent = "\u200b";
  range.insertNode(span);
  const rect = span.getBoundingClientRect();
  span.parentNode?.removeChild(span);
  selection.removeAllRanges();
  selection.addRange(range);
  return rect;
}

function isLockedNode(node: Node, root: HTMLElement): boolean {
  let current = node instanceof HTMLElement ? node : node.parentElement;
  while (current && current !== root) {
    if (current.getAttribute("contenteditable") === "false") return true;
    current = current.parentElement;
  }
  return false;
}

function textBeforeCaret(editor: HTMLElement): { text: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (!editor.contains(selection.anchorNode)) return null;
  const caret = selection.getRangeAt(0);
  if (isLockedNode(caret.commonAncestorContainer, editor)) return null;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let text = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (isLockedNode(node, editor)) continue;
    const afterNode = caret.comparePoint(node, node.data.length);
    if (afterNode < 0) {
      text += node.data;
      continue;
    }
    let offset = 0;
    while (offset <= node.data.length && caret.comparePoint(node, offset) < 0) offset += 1;
    text += node.data.slice(0, offset);
    break;
  }
  return { text };
}

function rangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (isLockedNode(node, root)) continue;
    const length = node.data.length;
    if (!startNode && count + length >= start) {
      startNode = node;
      startOffset = start - count;
    }
    if (count + length >= end) {
      endNode = node;
      endOffset = end - count;
      break;
    }
    count += length;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function replaceSlashWithHtml(editor: HTMLElement, start: number, html: string) {
  const prefix = textBeforeCaret(editor);
  if (!prefix) return;
  const range = rangeFromOffsets(editor, start, prefix.text.length);
  if (!range) return;
  const selection = window.getSelection();
  if (!selection) return;
  range.deleteContents();
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const fragment = document.createDocumentFragment();
  let last: ChildNode | null = null;
  while (holder.firstChild) {
    last = fragment.appendChild(holder.firstChild);
  }
  range.insertNode(fragment);
  if (last) {
    const next = document.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
  }
}

function insertHtml(html: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const fragment = document.createDocumentFragment();
  let last: ChildNode | null = null;
  while (holder.firstChild) {
    last = fragment.appendChild(holder.firstChild);
  }
  range.insertNode(fragment);
  if (last) {
    const next = document.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
  }
}

export function NoteEditor({
  noteId,
  title,
  content,
  trades,
  playbooks,
  readOnly = false,
  onTitleChange,
  onContentChange,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [slash, setSlash] = useState<{ query: string; start: number; x: number; y: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [embeds, setEmbeds] = useState<HTMLElement[]>([]);

  const emitContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    onContentChange(serializeNoteHtml(editor));
  }, [onContentChange]);

  const refreshEmbeds = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setEmbeds(Array.from(editor.querySelectorAll<HTMLElement>(`.${TRADE_EMBED_CLASS}`)));
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = content || "";
    setSlash(null);
    refreshEmbeds();
    // Reset the editor only when switching notes, not on autosave echoes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useLayoutEffect(() => {
    refreshEmbeds();
  }, [noteId, refreshEmbeds]);

  const slashTrades = useMemo(() => {
    if (!slash) return [];
    const needle = slash.query.trim().toLowerCase();
    const ranked = filterTradesForSlash(trades, "");
    if (!needle) return ranked.slice(0, 20);
    return ranked.filter((trade) => {
      const playbook = playbooks.find((item) => item.id === trade.checklistId)?.name ?? "";
      return [trade.pair, trade.direction, trade.date, trade.session, playbook]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    }).slice(0, 20);
  }, [playbooks, slash, trades]);

  useEffect(() => {
    setSlashIndex(0);
  }, [slash?.query]);

  const insertTrade = useCallback((tradeId: string) => {
    const editor = editorRef.current;
    if (!editor || !slash) return;
    editor.focus();
    replaceSlashWithHtml(editor, slash.start, tradeEmbedHtml(tradeId));
    setSlash(null);
    emitContent();
    refreshEmbeds();
  }, [emitContent, refreshEmbeds, slash]);

  const onInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const prefix = textBeforeCaret(editor);
    if (prefix) {
      const match = matchSlashTrade(prefix.text);
      if (match) {
        const rect = caretRect();
        setSlash({
          query: match.query,
          start: match.start,
          x: rect ? Math.min(rect.left, window.innerWidth - 420) : 24,
          y: rect ? rect.bottom + 8 : 120,
        });
      } else {
        setSlash(null);
      }
    }
    emitContent();
    refreshEmbeds();
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain").trim();
    const videoId = parseYouTubeId(text);
    if (videoId && !text.replace(text.match(/https?:\/\/\S+/i)?.[0] ?? text, "").trim()) {
      event.preventDefault();
      insertHtml(youtubeEmbedHtml(videoId));
      emitContent();
      refreshEmbeds();
      return;
    }
    if (text && parseYouTubeId(text)) {
      event.preventDefault();
      const { html } = replaceYouTubeUrlsWithEmbeds(text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      insertHtml(html.replace(/\n/g, "<br/>"));
      emitContent();
      refreshEmbeds();
    }
  };

  const format = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitContent();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Input
        value={title}
        readOnly={readOnly}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Note title"
        className="h-12 border-0 bg-transparent px-1 text-2xl font-semibold shadow-none focus-visible:ring-0"
      />

      {!readOnly && (
        <div className="study-notes-toolbar mb-4 mt-2 flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" onClick={() => format("bold")} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" onClick={() => format("italic")} title="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" onClick={() => format("underline")} title="Underline">
            <Underline className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" title="Heading" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.focus();
            document.execCommand("formatBlock", false, "h2");
            emitContent();
          }}>
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" onClick={() => format("insertUnorderedList")} title="Bulleted list">
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" onClick={() => format("insertOrderedList")} title="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 bg-muted text-foreground" onMouseDown={(event) => {
            event.preventDefault();
            editorRef.current?.focus();
            document.execCommand("formatBlock", false, "blockquote");
            emitContent();
          }} title="Quote">
            <Quote className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-[11px] text-muted-foreground">Type /trade to insert a live journal trade. Paste a YouTube link to embed it.</span>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={onInput}
        onPaste={onPaste}
        onBlur={emitContent}
        onKeyDown={(event) => {
          if (!slash) return;
          if (event.key === "Escape") {
            event.preventDefault();
            setSlash(null);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSlashIndex((index) => Math.min(index + 1, Math.max(slashTrades.length - 1, 0)));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSlashIndex((index) => Math.max(index - 1, 0));
            return;
          }
          if (event.key === "Enter" && slashTrades[slashIndex]) {
            event.preventDefault();
            insertTrade(slashTrades[slashIndex].id);
          }
        }}
        data-placeholder="Write your study notes. Type /trade to mention a journal trade."
        className={cn(
          "study-notes-editor min-h-[280px] flex-1 px-1 text-[15px] leading-7 outline-none",
          readOnly && "pointer-events-none opacity-80",
        )}
      />

      {embeds.map((node, index) => {
        const tradeId = node.dataset.tradeId;
        if (!tradeId) return null;
        return createPortal(
          <LiveTradeCard key={`${tradeId}-${index}`} tradeId={tradeId} trades={trades} playbooks={playbooks} />,
          node,
        );
      })}

      {slash && createPortal(
        <div
          className="fixed z-[80] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border/50 bg-popover/95 shadow-2xl backdrop-blur-md"
          style={{ left: slash.x, top: slash.y }}
        >
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {slash.query ? `Trades matching “${slash.query}”` : "Search journal trades"}
            </span>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto p-2">
            {slashTrades.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No trades match that search.</p>
            ) : (
              slashTrades.map((trade, index) => (
                <LiveTradeCard
                  key={trade.id}
                  tradeId={trade.id}
                  trades={trades}
                  playbooks={playbooks}
                  variant="menu"
                  active={index === slashIndex}
                  onSelect={() => insertTrade(trade.id)}
                />
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
