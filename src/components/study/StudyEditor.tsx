import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import type { Trade } from "@/types/trade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { isUnjournaledTrade } from "@/lib/notifications";
import {
  defaultStudyVideoAttrs,
  formatStudyVideoTime,
  matchSlashTrade,
  parseYouTubeId,
  pipNoteDividerStyle,
  pipNoteOffsetStyle,
  splitStudyTrades,
  splitStudyVideos,
  STUDY_VIDEO_DEFAULT_WIDTH,
  STUDY_VIDEO_DOCK_COMPANION_WIDTH,
  STUDY_VIDEO_MIN_WIDTH,
  STUDY_VIDEO_PIP_WIDTH,
  studyVideoNode,
  syncShownDualFlags,
  videoBlockFromLink,
  type StudyVideoAttrs,
} from "@/lib/studyArea";

/** Non-PiP dual companion: PiP-sized dock rail so the note column stays wide. */
function dockCompanionWidth(width: number | undefined) {
  return Math.max(
    STUDY_VIDEO_MIN_WIDTH,
    Math.min(width || STUDY_VIDEO_DOCK_COMPANION_WIDTH, STUDY_VIDEO_DOCK_COMPANION_WIDTH),
  );
}
import { cn } from "@/lib/utils";
import { StudyTradeCard } from "./StudyTradeCard";
import { StudyEditorDataProvider, type StudyPlaybook } from "./studyEditorData";
import { StudyTradeNode, StudyYoutubeNode } from "./studyNodes";
import { StudyVideoChrome, type StudyVideoHandle } from "./StudyVideoChrome";
import { useStudyTrash } from "./StudyTrash";
import {
  ArrowLeftRight,
  Bold,
  ChevronDown,
  Columns2,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Plus,
  Square,
  Star,
  Upload,
} from "lucide-react";

const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

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

function openNote(content: JSONContent) {
  const withoutTrades = splitStudyTrades(content);
  const withoutVideo = splitStudyVideos(withoutTrades.doc);
  return {
    doc: withoutVideo.doc,
    tradeIds: withoutTrades.tradeIds,
    videos: withoutVideo.videos,
    activeId: withoutVideo.activeId,
  };
}

export function StudyEditor({ noteId, title, content, trades, playbooks, onSave, onOpenJournal, onOpenPlaybook }: StudyEditorProps) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [status, setStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [slash, setSlash] = useState<{ query: string; from: number; to: number; x: number; y: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const opened = useRef(openNote(content));
  const [tradeIds, setTradeIds] = useState<string[]>(opened.current.tradeIds);
  const tradeIdsRef = useRef(opened.current.tradeIds);
  const [resources, setResources] = useState<StudyVideoAttrs[]>(opened.current.videos);
  const resourcesRef = useRef<StudyVideoAttrs[]>(opened.current.videos);
  const [activeResourceId, setActiveResourceId] = useState<string | null>(opened.current.activeId);
  const activeResourceIdRef = useRef<string | null>(opened.current.activeId);
  const shownResources = resources.filter((item) => item.shown);
  const video =
    shownResources.find((item) => item.id === activeResourceId) ?? shownResources[0] ?? null;
  const videoRef = useRef<StudyVideoAttrs | null>(video);
  videoRef.current = video;
  const [addingTrade, setAddingTrade] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [tradeQuery, setTradeQuery] = useState("");
  const [addingResource, setAddingResource] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [resourceLink, setResourceLink] = useState("");
  const [resourceError, setResourceError] = useState("");
  /** Dual docked: side-by-side (true) vs one-at-a-time with switcher (false). */
  const [dualExpanded, setDualExpanded] = useState(true);
  /** Left→right order for side-by-side dual lane (drag to swap). */
  const [dualLaneOrder, setDualLaneOrder] = useState<string[]>([]);
  const dualLaneDragIdRef = useRef<string | null>(null);
  const [dualDropSide, setDualDropSide] = useState<"left" | "right" | null>(null);
  const resourceFileRef = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState(0);
  const dirtyRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const pendingTimestampRef = useRef<number | null>(null);
  const videoHandleRef = useRef<StudyVideoHandle | null>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const { beginDrag, registerDeleter } = useStudyTrash();

  const commitResources = (next: StudyVideoAttrs[], nextActiveId: string | null) => {
    const synced = syncShownDualFlags(next, nextActiveId);
    resourcesRef.current = synced.list;
    activeResourceIdRef.current = synced.activeId;
    setResources(synced.list);
    setActiveResourceId(synced.activeId);
    dirtyRef.current = true;
    setRevision((value) => value + 1);
  };

  /** Per-video PiP/dock: PiP adds that video to the float stack; Dock only affects the chosen one. */
  const applyResourcePatch = (resourceId: string, next: StudyVideoAttrs) => {
    const list = resourcesRef.current;
    const exists = list.some((item) => item.id === resourceId);
    if (!exists) {
      commitResources([...list, { ...next, id: resourceId, dual: false, shown: next.shown ?? true }], resourceId);
      return;
    }
    const dualOn = list.some((item) => item.dual);
    const prev = list.find((item) => item.id === resourceId);
    const otherPip = list.find((item) => item.id !== resourceId && item.pip);
    const enteringPip = Boolean(!prev?.pip && next.pip);
    const leavingPip = Boolean(prev?.pip && !next.pip);
    const dockWidth = (width: number | undefined) =>
      dualOn ? dockCompanionWidth(width) : Math.max(width || STUDY_VIDEO_DEFAULT_WIDTH, STUDY_VIDEO_DEFAULT_WIDTH);
    // Adding to PiP beside an existing floater — share corner/size so they stack cleanly.
    const pipAligned =
      next.pip && otherPip
        ? {
            ...next,
            pipCorner: otherPip.pipCorner,
            width: otherPip.width,
            locked: otherPip.locked,
          }
        : next;
    const nextList = list.map((item) => {
      if (item.id !== resourceId) return item;
      return {
        ...pipAligned,
        id: resourceId,
        dual: item.dual,
        width: pipAligned.pip
          ? // Entering PiP starts compact; afterward resize can grow to half the notes page.
            enteringPip && !otherPip
            ? Math.min(Math.max(pipAligned.width, STUDY_VIDEO_MIN_WIDTH), STUDY_VIDEO_PIP_WIDTH)
            : Math.max(STUDY_VIDEO_MIN_WIDTH, pipAligned.width)
          : // Only snap to companion size when leaving PiP — allow docked resize afterward.
            leavingPip
            ? dockWidth(pipAligned.width)
            : Math.max(STUDY_VIDEO_MIN_WIDTH, pipAligned.width),
      };
    });
    // Keep dual partner layout in sync when resizing/moving a shared PiP stack.
    const patched = nextList.map((item) => {
      if (!dualOn || item.id === resourceId || !item.pip || !pipAligned.pip) return item;
      const syncedWidth = nextList.find((row) => row.id === resourceId)?.width ?? pipAligned.width;
      return {
        ...item,
        pipCorner: pipAligned.pipCorner,
        width: syncedWidth,
        locked: pipAligned.locked,
      };
    });
    const keepActive = activeResourceIdRef.current;
    commitResources(patched, keepActive && patched.some((item) => item.id === keepActive) ? keepActive : resourceId);
  };

  const setVideoState = (next: StudyVideoAttrs | null) => {
    if (!next) {
      const remaining = resourcesRef.current.filter((item) => item.id !== activeResourceIdRef.current);
      commitResources(remaining, remaining[0]?.id ?? null);
      if (remaining.length === 0) setResourceOpen(false);
      return;
    }
    const currentId = activeResourceIdRef.current;
    const targetId = next.id || currentId;
    if (!targetId) return;
    applyResourcePatch(targetId, next);
  };

  const selectResource = (id: string) => {
    const list = resourcesRef.current;
    const target = list.find((item) => item.id === id);
    if (!target) return;
    // Selecting a hidden video only marks it main — Show puts it on screen.
    commitResources(list, id);
  };

  /** Switch control: also exchange PiP/dock when the pair is mixed. */
  const switchDualVideo = () => {
    const list = resourcesRef.current;
    const dualled = list.find((item) => item.dual && item.shown);
    const primaryId = activeResourceIdRef.current;
    if (!dualled || !primaryId) return;
    const primary = list.find((item) => item.id === primaryId);
    const other = dualled;
    if (!primary) return;
    const mixed = primary.pip !== other.pip;
    if (!mixed) {
      selectResource(other.id);
      return;
    }
    commitResources(
      list.map((item) => {
        if (item.id !== primary.id && item.id !== other.id) return item;
        const swapWith = item.id === primary.id ? other : primary;
        return {
          ...item,
          pip: swapWith.pip,
          pipCorner: swapWith.pipCorner,
          width: swapWith.pip
            ? Math.min(Math.max(swapWith.width, STUDY_VIDEO_MIN_WIDTH), STUDY_VIDEO_PIP_WIDTH)
            : dockCompanionWidth(swapWith.width),
          locked: swapWith.locked,
        };
      }),
      other.id,
    );
  };

  /** Show / unshow any resource in the player (at most two visible). */
  const toggleShown = (id: string) => {
    const list = resourcesRef.current;
    const target = list.find((item) => item.id === id);
    if (!target) return;
    if (target.shown) {
      const next = list.map((item) =>
        item.id === id ? { ...item, shown: false, dual: false } : item,
      );
      const nextActive =
        activeResourceIdRef.current === id
          ? next.find((item) => item.shown)?.id ?? activeResourceIdRef.current
          : activeResourceIdRef.current;
      commitResources(next, nextActive);
      return;
    }
    const keepId = activeResourceIdRef.current;
    const shownCount = list.filter((item) => item.shown).length;
    // Cap at two on-screen videos — drop extra companions, keep main + this one.
    const next = list.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          shown: true,
          pip: false,
          width: videoRef.current?.width ?? item.width,
          pipCorner: videoRef.current?.pipCorner ?? item.pipCorner,
          locked: videoRef.current?.locked ?? item.locked,
        };
      }
      if (shownCount >= 2 && item.shown && item.id !== keepId) {
        return { ...item, shown: false, dual: false };
      }
      return item;
    });
    setDualExpanded(true);
    commitResources(next, keepId && list.some((item) => item.id === keepId) ? keepId : id);
  };

  const addResource = (partial: Partial<StudyVideoAttrs>) => {
    const current = videoRef.current;
    const item = defaultStudyVideoAttrs({
      ...partial,
      width: current?.width,
      pip: current?.pip,
      pipCorner: current?.pipCorner,
      locked: current?.locked,
      timestampsEnabled: current?.timestampsEnabled,
      active: true,
      shown: true,
    });
    // New video is shown; if two are already visible, hide other companions.
    const prior = resourcesRef.current.map((row) =>
      row.shown && row.id !== activeResourceIdRef.current
        ? { ...row, shown: false, dual: false }
        : row,
    );
    commitResources([...prior, item], item.id);
    setResourceOpen(true);
  };

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
        class: "study-prose min-h-[calc(100dvh-22rem)] px-1 py-2 text-[15px] leading-7 outline-none",
      },
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
        const videoId = parseYouTubeId(text);
        if (!videoId) return false;
        event.preventDefault();
        addResource({ videoId, src: null, title: null });
        return true;
      },
      handleKeyDown(_view, event) {
        if (event.key !== "Enter" || event.shiftKey) return false;
        const current = videoRef.current;
        if (!current?.timestampsEnabled) return false;
        if (!videoHandleRef.current?.isPlaying()) return false;
        pendingTimestampRef.current = videoHandleRef.current.getCurrentTime();
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      dirtyRef.current = true;
      setRevision((value) => value + 1);

      if (pendingTimestampRef.current != null) {
        const seconds = pendingTimestampRef.current;
        pendingTimestampRef.current = null;
        const { $from } = current.state.selection;
        if ($from.parent.type.name === "paragraph" && $from.parent.content.size === 0) {
          current.commands.insertContent(`${formatStudyVideoTime(seconds)} `);
        }
      }

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
    const prose = (snapshot.content ?? []).filter(
      (node) => node.type !== "studyTrade" && node.type !== "studyYoutube",
    );
    const attached = resourcesRef.current.map((item) =>
      studyVideoNode({ ...item, active: item.id === activeResourceIdRef.current }),
    );
    const saved = {
      ...snapshot,
      content: [
        ...attached,
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

  const forgetTrade = (tradeId: string) => {
    const next = tradeIdsRef.current.filter((id) => id !== tradeId);
    tradeIdsRef.current = next;
    setTradeIds(next);
    if (next.length === 0) setTradesOpen(false);
    dirtyRef.current = true;
    setRevision((value) => value + 1);
  };

  const removeVideo = (id?: string) => {
    const target = id ?? activeResourceIdRef.current;
    if (!target) return;
    const remaining = resourcesRef.current.filter((item) => item.id !== target);
    const nextActive =
      activeResourceIdRef.current === target ? remaining[0]?.id ?? null : activeResourceIdRef.current;
    commitResources(remaining, nextActive);
    if (remaining.length === 0) setResourceOpen(false);
  };

  useEffect(() => registerDeleter("trade", forgetTrade), [forgetTrade, registerDeleter]);
  useEffect(() => registerDeleter("video", () => removeVideo()), [registerDeleter]);

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

  const applyResourceLink = () => {
    // Don't seed YouTube title from the note name — chrome resolves it via oEmbed.
    const block = videoBlockFromLink(resourceLink, null);
    if (!block?.attrs) {
      setResourceError("Paste a video link, such as a YouTube URL.");
      return;
    }
    addResource({
      videoId: (block.attrs.videoId as string | null) ?? null,
      src: (block.attrs.src as string | null) ?? null,
      title: (block.attrs.title as string | null) ?? null,
    });
    setResourceLink("");
    setResourceError("");
    setAddingResource(false);
  };

  const applyResourceUpload = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setResourceError("Choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setResourceError("That video is larger than 12 MB. Paste a link instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) {
        setResourceError("Could not read that video.");
        return;
      }
      addResource({
        videoId: null,
        src,
        title: file.name.replace(/\.[^.]+$/, "") || draftTitle || "Video",
      });
      setResourceError("");
      setAddingResource(false);
    };
    reader.onerror = () => setResourceError("Could not read that video.");
    reader.readAsDataURL(file);
  };

  const tradePicker = (
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
  );

  const resourcePicker = (
    <PopoverContent
      align="end"
      side="bottom"
      sideOffset={10}
      collisionPadding={16}
      className="w-[min(24rem,calc(100vw-2rem))] space-y-3 p-4 liquid-glass projection-popover shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none"
    >
      <p className="text-sm font-medium text-muted-foreground">Add a video resource</p>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={resourceLink}
          onChange={(event) => {
            setResourceLink(event.target.value);
            setResourceError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyResourceLink();
            }
          }}
          placeholder="YouTube URL or video link"
          className="h-10 w-full rounded-xl border border-border/50 bg-background/70 pl-8 pr-3 text-sm outline-none focus:border-primary/40"
        />
      </div>
      {resourceError ? <p className="text-xs text-destructive">{resourceError}</p> : null}
      <button
        type="button"
        onClick={applyResourceLink}
        className="w-full rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
      >
        Use link
      </button>
      <button
        type="button"
        onClick={() => resourceFileRef.current?.click()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/60 px-3 py-2 text-sm"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload a video
      </button>
      <input
        ref={resourceFileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) applyResourceUpload(file);
        }}
      />
    </PopoverContent>
  );

  const dualVideo = resources.find((item) => item.dual && item.id !== video?.id) ?? null;
  const dualActive = Boolean(dualVideo && video);
  const primaryPip = Boolean(video?.pip);
  const dualPip = Boolean(dualVideo?.pip);
  const showDualPair = dualActive && dualExpanded;
  const dockDual = Boolean(showDualPair && !primaryPip && !dualPip);
  const dualBothPip = Boolean(dualActive && primaryPip && dualPip);
  const dualMixed = Boolean(dualActive && primaryPip !== dualPip);
  const pipStackCount = dualBothPip ? 2 : 1;
  const dockCompanion = dualMixed ? (primaryPip ? dualVideo : video) : null;
  const floatingPip = dualBothPip || primaryPip
    ? video
    : dualPip
      ? dualVideo
      : null;
  const companionWidth = dockCompanion
    ? dockCompanionWidth(dockCompanion.width)
    : STUDY_VIDEO_PIP_WIDTH;
  // Note padding / divider follow the floating PiP stack.
  const pipForNotes = floatingPip;
  const anyDockedVideo = Boolean(dockDual || dockCompanion || (video && !floatingPip && !dualMixed && !dualBothPip));
  const onlyPipChrome = Boolean(floatingPip && !dockCompanion && !dockDual);

  const applyDualMediaChange = (dualId: string, next: StudyVideoAttrs) => {
    applyResourcePatch(dualId, { ...next, dual: true, shown: true });
  };

  const anyDualPip = primaryPip || dualPip;

  const goOneAtATime = () => {
    setDualExpanded(false);
    // Bring the main (playing) video back to dock-to-note.
    if (video?.pip) {
      applyResourcePatch(video.id, { ...video, pip: false });
    }
  };

  const dualToggleButton = (() => {
    if (!dualActive) return null;
    // In PiP, side-by-side is irrelevant — only offer One at a time (docks main).
    if (anyDualPip) {
      return (
        <button
          type="button"
          onClick={goOneAtATime}
          title="One at a time — dock main video"
          aria-label="One at a time — dock main video"
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-background/85 px-2 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border/50 transition hover:bg-background hover:text-foreground"
        >
          <Square className="h-3.5 w-3.5" />
          One at a time
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setDualExpanded(!dualExpanded)}
        title={dualExpanded ? "View one at a time" : "Show side by side"}
        aria-label={dualExpanded ? "View one at a time" : "Show side by side"}
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-background/85 px-2 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border/50 transition hover:bg-background hover:text-foreground"
      >
        {dualExpanded ? <Square className="h-3.5 w-3.5" /> : <Columns2 className="h-3.5 w-3.5" />}
        {dualExpanded ? "One at a time" : "Side by side"}
      </button>
    );
  })();

  const dualSwitcher =
    dualActive && !dualExpanded && dualVideo && video ? (
      <button
        type="button"
        onClick={() => switchDualVideo()}
        title="Switch dual video"
        aria-label="Switch dual video"
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-background/85 px-2 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border/50 transition hover:bg-background hover:text-foreground"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Switch video
      </button>
    ) : null;

  const oneAtATime = dualActive && !dualExpanded;
  const sideBySideDock = Boolean(dockDual);
  const defaultDockMaxRatio =
    !video?.pip && oneAtATime ? 0.5 : sideBySideDock ? 1 / 3 : undefined;
  // Stable id order so swapping "Playing now" does not remount players.
  const dualPairSorted =
    dualActive && video && dualVideo
      ? [video, dualVideo].sort((a, b) => a.id.localeCompare(b.id))
      : null;

  // Keep side-by-side lane order in sync with the dual pair (preserve drag order when possible).
  useEffect(() => {
    if (!video || !dualVideo) {
      setDualLaneOrder([]);
      return;
    }
    const ids = [video.id, dualVideo.id];
    setDualLaneOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      for (const id of ids) {
        if (!kept.includes(id)) kept.push(id);
      }
      return kept.slice(0, 2);
    });
  }, [video?.id, dualVideo?.id]);

  useEffect(() => {
    const clearLaneDrag = () => {
      dualLaneDragIdRef.current = null;
      setDualDropSide(null);
    };
    document.addEventListener("dragend", clearLaneDrag);
    return () => document.removeEventListener("dragend", clearLaneDrag);
  }, []);

  const dualPairOrdered =
    dualActive && video && dualVideo && dualLaneOrder.length === 2
      ? dualLaneOrder
          .map((id) => (id === video.id ? video : id === dualVideo.id ? dualVideo : null))
          .filter((item): item is StudyVideoAttrs => Boolean(item))
      : dualPairSorted;

  const placeDualOnSide = (dragId: string, side: "left" | "right") => {
    if (!dualPairOrdered || dualPairOrdered.length < 2) return;
    const other = dualPairOrdered.find((item) => item.id !== dragId);
    if (!other) return;
    setDualLaneOrder(side === "left" ? [dragId, other.id] : [other.id, dragId]);
  };

  const renderResourceChrome = (
    item: StudyVideoAttrs,
    opts?: {
      fillWidth?: boolean;
      stackIndex?: number;
      stackBaseWidth?: number;
      dockSized?: boolean;
      dockMaxRatio?: number;
      centerDock?: boolean;
      laneReorder?: boolean;
      /** Align layout to the active player (shared PiP stack). */
      syncLayoutFrom?: StudyVideoAttrs | null;
    },
  ) => {
    const isActive = item.id === activeResourceId;
    const display: StudyVideoAttrs = opts?.dockSized
      ? { ...item, pip: false, width: dockCompanionWidth(item.width) }
      : opts?.syncLayoutFrom
        ? {
            ...item,
            pip: true,
            pipCorner: opts.syncLayoutFrom.pipCorner,
            width: opts.syncLayoutFrom.width,
            locked: opts.syncLayoutFrom.locked,
          }
        : item;
    const dockMaxRatio =
      opts?.dockMaxRatio ?? (!display.pip ? defaultDockMaxRatio : undefined);
    return (
      <StudyVideoChrome
        key={item.id}
        video={display}
        noteId={noteId}
        noteTitle={draftTitle}
        boundsRef={notesRef}
        stackIndex={opts?.stackIndex ?? 0}
        stackCount={pipStackCount}
        stackBaseWidth={opts?.stackBaseWidth}
        fillWidth={opts?.fillWidth}
        dockMaxRatio={dockMaxRatio}
        centerDock={opts?.centerDock ?? Boolean(oneAtATime && !display.pip)}
        isMain={isActive}
        onLaneDragStart={
          opts?.laneReorder
            ? (videoId) => {
                dualLaneDragIdRef.current = videoId;
              }
            : undefined
        }
        handleRef={isActive ? videoHandleRef : undefined}
        onChange={(next) =>
          isActive ? setVideoState(next) : applyDualMediaChange(item.id, next)
        }
        onRemove={() => removeVideo(item.id)}
      />
    );
  };

  const dualControls = dualActive ? (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2",
        onlyPipChrome && "pointer-events-auto absolute right-3 top-3 z-50",
        !onlyPipChrome && "mb-2",
      )}
    >
      {dualSwitcher}
      {dualToggleButton}
    </div>
  ) : null;

  const videoChrome = video ? (
    dockDual && dualPairOrdered ? (
      <div className="space-y-2">
        {dualControls}
        <div
          className="relative flex flex-wrap items-start justify-center gap-2"
          onDragOver={(event) => {
            if (!dualLaneDragIdRef.current) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const rect = event.currentTarget.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            setDualDropSide(event.clientX < mid ? "left" : "right");
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDualDropSide(null);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            const dragId =
              dualLaneDragIdRef.current ||
              event.dataTransfer.getData("application/x-study-dual-lane");
            const side = dualDropSide;
            dualLaneDragIdRef.current = null;
            setDualDropSide(null);
            if (!dragId || !side) return;
            placeDualOnSide(dragId, side);
          }}
          onDragEnd={() => {
            dualLaneDragIdRef.current = null;
            setDualDropSide(null);
          }}
        >
          {dualDropSide ? (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 w-1/2 rounded-xl ring-2 ring-foreground/40 ring-inset",
                dualDropSide === "left" ? "left-0" : "right-0",
              )}
            />
          ) : null}
          {dualPairOrdered.map((item) =>
            renderResourceChrome(item, { dockMaxRatio: 1 / 3, laneReorder: true }),
          )}
        </div>
      </div>
    ) : dualBothPip && dualPairSorted ? (
      <>
        {dualControls}
        {dualPairSorted.map((item, index) =>
          renderResourceChrome(item, {
            stackIndex: index,
            stackBaseWidth: dualPairSorted[0]?.width,
            syncLayoutFrom: index > 0 ? dualPairSorted[0] : null,
          }),
        )}
      </>
    ) : dualMixed && dualPairSorted ? (
      <div className="space-y-2">
        {dualControls}
        <div
          className={cn("w-full", oneAtATime ? "mx-auto flex justify-center" : "mx-auto")}
          style={
            oneAtATime
              ? { maxWidth: "100%" }
              : { width: companionWidth, maxWidth: "100%" }
          }
        >
          {dualPairSorted
            .filter((item) => !item.pip)
            .map((item) =>
              renderResourceChrome(item, {
                dockSized: !oneAtATime,
                fillWidth: !oneAtATime,
                dockMaxRatio: oneAtATime ? 0.5 : undefined,
                centerDock: oneAtATime,
              }),
            )}
        </div>
        {dualPairSorted
          .filter((item) => item.pip)
          .map((item) => renderResourceChrome(item, { stackIndex: 0 }))}
      </div>
    ) : (
      <div className="w-full space-y-2">
        {dualControls}
        <div className={cn(oneAtATime && !video.pip && "flex w-full justify-center")}>
          {renderResourceChrome(video, {
            stackIndex: 0,
            centerDock: oneAtATime && !video.pip,
          })}
        </div>
      </div>
    )
  ) : null;

  const noteBody = (
    <>
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
      {video ? (
        <div className="mb-3 mt-1 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-foreground">Timestamps</span>
            <Switch
              checked={video.timestampsEnabled}
              onCheckedChange={(checked) => setVideoState({ ...video, timestampsEnabled: checked })}
              aria-label="Timestamps"
            />
            <span className="text-[11px] text-muted-foreground">{video.timestampsEnabled ? "On" : "Off"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Lines you start while the video plays get its time.</p>
        </div>
      ) : null}
      <div className="mb-3 mt-2 flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
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
    </>
  );

  const dockLocked = Boolean(video?.locked && !video?.pip);
  // Unlocked PiP stays on screen while notes scroll; locked PiP scrolls with the notes.
  const pipFloat = Boolean(pipForNotes && !pipForNotes.locked);
  const pipLocked = Boolean(pipForNotes?.pip && pipForNotes.locked);
  const splitScroll = dockLocked || pipFloat;

  return (
    <StudyEditorDataProvider value={{ trades, playbooks, onOpenJournal, onOpenPlaybook }}>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-6 lg:flex-row",
          splitScroll ? "h-[calc(100dvh-14rem)] lg:items-stretch" : "lg:items-start",
        )}
      >
        <div
          ref={notesRef}
          className={cn(
            "relative min-w-0 flex-1",
            splitScroll && "flex min-h-0 flex-col",
            pipLocked && "min-h-[calc(100dvh-14rem)]",
          )}
        >
          {video ? (
            <div
              className={cn(
                onlyPipChrome
                  ? "pointer-events-none contents"
                  : cn("mb-5 space-y-4", dockLocked && "shrink-0"),
              )}
            >
              {/* Single mount keeps playback alive across dock ↔ picture-in-picture. */}
              <div className={cn(onlyPipChrome ? "pointer-events-auto" : "mx-auto w-full")}>
                {videoChrome}
              </div>
              {anyDockedVideo ? <div className="border-t border-border/40" /> : null}
            </div>
          ) : null}

          <div
            className={cn(
              "relative",
              splitScroll && "min-h-0 flex-1 overflow-y-auto pr-1",
              pipForNotes && "transition-[padding] duration-200",
            )}
            style={
              pipForNotes
                ? pipNoteOffsetStyle(pipForNotes.pipCorner, pipForNotes.width)
                : undefined
            }
          >
            {pipForNotes ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-border/50"
                style={pipNoteDividerStyle(pipForNotes.pipCorner, pipForNotes.width)}
              />
            ) : null}
            {noteBody}
          </div>
        </div>

        <aside className={cn("w-full shrink-0 lg:w-80", splitScroll && "min-h-0 overflow-y-auto")}>
          <div className="flex flex-wrap items-center gap-2">
            {tradeIds.length === 0 ? (
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
                {tradePicker}
              </Popover>
            ) : (
              <>
                <button
                  type="button"
                  aria-expanded={tradesOpen}
                  onClick={() => setTradesOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
                >
                  Trades
                  <ChevronDown className={`h-4 w-4 transition-transform ${tradesOpen ? "rotate-180" : ""}`} />
                </button>
                {tradesOpen ? (
                  <Popover open={addingTrade} onOpenChange={setAddingTrade}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Add journaled trade"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 text-foreground hover:bg-muted/50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    {tradePicker}
                  </Popover>
                ) : null}
              </>
            )}

            {!video ? (
              <Popover
                open={addingResource}
                onOpenChange={(open) => {
                  setAddingResource(open);
                  if (!open) {
                    setResourceLink("");
                    setResourceError("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-expanded={addingResource}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
                  >
                    <Plus className="h-4 w-4" />
                    Add resource
                  </button>
                </PopoverTrigger>
                {resourcePicker}
              </Popover>
            ) : (
              <>
                <button
                  type="button"
                  aria-expanded={resourceOpen}
                  onClick={() => setResourceOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
                >
                  Resource
                  <ChevronDown className={`h-4 w-4 transition-transform ${resourceOpen ? "rotate-180" : ""}`} />
                </button>
                {resourceOpen ? (
                  <Popover
                    open={addingResource}
                    onOpenChange={(open) => {
                      setAddingResource(open);
                      if (!open) {
                        setResourceLink("");
                        setResourceError("");
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Add video resource"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 text-foreground hover:bg-muted/50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    {resourcePicker}
                  </Popover>
                ) : null}
              </>
            )}
          </div>
          {tradesOpen && tradeIds.length > 0 ? (
            <div className="mt-3 space-y-2">
              {tradeIds.map((tradeId) => (
                <StudyTradeCard
                  key={tradeId}
                  tradeId={tradeId}
                  trades={trades}
                  playbooks={playbooks}
                  onOpenJournal={onOpenJournal}
                  onOpenPlaybook={onOpenPlaybook}
                  onRemove={forgetTrade}
                  onDragStart={(event) => beginDrag(event, {
                    kind: "trade",
                    id: tradeId,
                    label: trades.find((trade) => trade.id === tradeId)?.pair || "Trade",
                  })}
                />
              ))}
            </div>
          ) : null}
          {resourceOpen && resources.length > 0 ? (
            <div className="mt-3 space-y-2">
              {resources.map((item) => {
                const selected = item.id === activeResourceId;
                const label =
                  (item.title || (item.videoId ? "YouTube video" : null) || draftTitle || "Video").trim() ||
                  "Video";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 transition-colors",
                      selected ? "border-foreground/40 bg-background/70" : "border-border/50 bg-background/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectResource(item.id)}
                      className="w-full text-left"
                    >
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        {selected ? (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-current text-foreground" aria-label="Main video" />
                        ) : null}
                        <span className="truncate">{label}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {selected && item.shown ? "Playing now · " : ""}
                        {!item.shown ? "Hidden · " : ""}
                        {item.videoId ? "YouTube video" : "Uploaded video"}
                      </p>
                    </button>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => removeVideo(item.id)}
                        className="text-[11px] text-destructive hover:underline"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleShown(item.id)}
                        className={cn(
                          "text-[11px] hover:underline",
                          item.shown ? "text-foreground font-medium" : "text-muted-foreground",
                        )}
                      >
                        {item.shown ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </aside>

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
