import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
} from "react";
import { ArrowDownRight, Grip, Link2, PictureInPicture2, Play, Star, Upload } from "lucide-react";
import {
  defaultStudyVideoAttrs,
  dualStackOffset,
  fetchYouTubeTitle,
  nearestCorner,
  pipMaxWidthFromBounds,
  STUDY_VIDEO_DEFAULT_WIDTH,
  STUDY_VIDEO_DUAL_GAP,
  STUDY_VIDEO_MIN_WIDTH,
  STUDY_VIDEO_PIP_INSET,
  STUDY_VIDEO_PIP_WIDTH,
  type StudyVideoAttrs,
  type StudyVideoCorner,
  videoBlockFromLink,
  youtubeThumbUrl,
} from "@/lib/studyArea";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudyTrash } from "./StudyTrash";

const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const PIP_INSET = STUDY_VIDEO_PIP_INSET;

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onStateChange?: (event: { data: number; target: YtPlayer }) => void;
          };
        },
      ) => YtPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration?: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

const PROGRESS_SAVE_MS = 5000;

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prior?.();
      resolve();
    };
    if (!document.querySelector('script[data-study-yt]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.studyYt = "1";
      document.head.appendChild(script);
    }
  });
  return ytApiPromise;
}

export type StudyVideoHandle = {
  getCurrentTime: () => number;
  isPlaying: () => boolean;
};

export function StudyVideoChrome({
  video,
  noteId,
  noteTitle,
  className,
  boundsRef,
  stackIndex = 0,
  stackCount = 1,
  stackBaseWidth,
  fillWidth = false,
  dockMaxRatio,
  centerDock = false,
  isMain = false,
  onLaneDragStart,
  onChange,
  onRemove,
  handleRef,
}: {
  video: StudyVideoAttrs;
  noteId: string;
  noteTitle?: string;
  className?: string;
  boundsRef?: RefObject<HTMLElement | null>;
  /** 0 = primary PiP, 1+ = stacked under/above for Dual */
  stackIndex?: number;
  /** Total PiP frames in the stack (1 normal, 2 in Dual) — caps resize to the notes area. */
  stackCount?: number;
  /** When stacked under a wider dock companion, offset using that width instead of this frame's. */
  stackBaseWidth?: number;
  /** Docked Dual side-by-side cell: fill the grid column instead of fixed width. */
  fillWidth?: boolean;
  /** Docked resize cap as a fraction of the notes page (e.g. 0.5 or 1/3). */
  dockMaxRatio?: number;
  /** One-at-a-time: keep the docked card centered in the notes column. */
  centerDock?: boolean;
  /** Dual main / “Playing now” video. */
  isMain?: boolean;
  /** Side-by-side: also announce this video for left/right lane reorder (bin drag still works). */
  onLaneDragStart?: (videoId: string) => void;
  onChange: (next: StudyVideoAttrs) => void;
  onRemove: () => void;
  handleRef?: Ref<StudyVideoHandle | null>;
}) {
  const { beginDrag } = useStudyTrash();
  const pip = video.pip;
  const [watching, setWatching] = useState(() => (video.startAt ?? 0) > 1);
  const [changeOpen, setChangeOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [fileError, setFileError] = useState("");
  const [draftWidth, setDraftWidth] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YtPlayer | null>(null);
  const playingRef = useRef(false);
  const videoAttrsRef = useRef(video);
  videoAttrsRef.current = video;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const resizeRef = useRef<{ startX: number; startWidth: number; maxWidth: number; current: number } | null>(null);
  const moveRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    currentLeft: number;
    currentTop: number;
    width: number;
    height: number;
    boxWidth: number;
    boxHeight: number;
  } | null>(null);

  const [resolvedTitle, setResolvedTitle] = useState<string | null>(null);
  const displayTitle =
    (video.title || resolvedTitle || (video.videoId ? "YouTube video" : noteTitle) || "Video").trim() ||
    "Video";
  const thumb = video.videoId ? youtubeThumbUrl(video.videoId) : null;
  const boundsEl = boundsRef?.current;
  const boundsWidth = boundsEl?.clientWidth || STUDY_VIDEO_DEFAULT_WIDTH * 1.5;
  const pipMaxWidth = pipMaxWidthFromBounds(
    boundsWidth,
    boundsEl?.clientHeight || STUDY_VIDEO_DEFAULT_WIDTH,
    stackCount,
  );
  const dockMaxWidth =
    typeof dockMaxRatio === "number" && dockMaxRatio > 0
      ? Math.max(STUDY_VIDEO_MIN_WIDTH, Math.floor(boundsWidth * dockMaxRatio))
      : Math.max(STUDY_VIDEO_MIN_WIDTH, boundsWidth);
  const width =
    draftWidth ??
    (pip
      ? Math.min(video.width || STUDY_VIDEO_PIP_WIDTH, pipMaxWidth)
      : typeof dockMaxRatio === "number"
        ? Math.min(video.width || STUDY_VIDEO_PIP_WIDTH, dockMaxWidth)
        : video.width) ??
    STUDY_VIDEO_DEFAULT_WIDTH;
  const anchoredRight = pip && (video.pipCorner === "tr" || video.pipCorner === "br");
  const stackUnitWidth = stackBaseWidth ?? width;
  const stackHeight =
    Math.round((stackUnitWidth * 9) / 16) * Math.max(1, stackCount) +
    Math.max(0, Math.max(1, stackCount) - 1) * STUDY_VIDEO_DUAL_GAP;

  const readTime = () => {
    if (video.src && videoElRef.current) return videoElRef.current.currentTime || 0;
    if (ytPlayerRef.current) {
      try {
        return ytPlayerRef.current.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  const syncPlaying = (next: boolean) => {
    playingRef.current = next;
  };

  const persistProgress = (seconds: number, force = false) => {
    const next = Math.max(0, Math.floor(seconds));
    const current = videoAttrsRef.current;
    // Near the end, store 0 so the next visit starts fresh.
    let duration = 0;
    try {
      duration = ytPlayerRef.current?.getDuration?.() || videoElRef.current?.duration || 0;
    } catch {
      duration = 0;
    }
    const saved = duration > 0 && next >= duration - 2 ? 0 : next;
    if (!force && Math.abs(saved - (current.startAt || 0)) < 2) return;
    if (saved === (current.startAt || 0)) return;
    onChangeRef.current({ ...current, startAt: saved });
  };

  useImperativeHandle(
    handleRef,
    () => ({
      getCurrentTime: readTime,
      isPlaying: () => playingRef.current,
    }),
    [video.src, video.videoId],
  );

  useEffect(() => {
    if (!watching || !video.videoId || !ytMountRef.current) return;
    let cancelled = false;
    const trackedId = video.videoId;
    const resumeAt = Math.max(0, videoAttrsRef.current.startAt || 0);
    void loadYouTubeApi().then(() => {
      if (cancelled || !ytMountRef.current || !window.YT?.Player) return;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = new window.YT.Player(ytMountRef.current, {
        videoId: trackedId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          ...(resumeAt > 0 ? { start: resumeAt } : {}),
        },
        events: {
          onReady: (event) => {
            if (resumeAt > 0) {
              try {
                event.target.seekTo(resumeAt, true);
              } catch {
                /* ignore seek errors */
              }
            }
            event.target.playVideo();
            syncPlaying(true);
          },
          onStateChange: (event) => {
            const playingCode = window.YT?.PlayerState?.PLAYING ?? 1;
            const pausedCode = window.YT?.PlayerState?.PAUSED ?? 2;
            const endedCode = window.YT?.PlayerState?.ENDED ?? 0;
            if (event.data === playingCode) syncPlaying(true);
            if (event.data === pausedCode) {
              syncPlaying(false);
              try {
                if (videoAttrsRef.current.videoId === trackedId) {
                  persistProgress(event.target.getCurrentTime(), true);
                }
              } catch {
                /* ignore */
              }
            }
            if (event.data === endedCode) {
              syncPlaying(false);
              if (videoAttrsRef.current.videoId === trackedId) persistProgress(0, true);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        const t = ytPlayerRef.current?.getCurrentTime();
        if (typeof t === "number" && t > 0 && videoAttrsRef.current.videoId === trackedId) {
          persistProgress(t, true);
        }
      } catch {
        /* ignore */
      }
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [watching, video.videoId]);

  // Periodically persist watch position while playing.
  useEffect(() => {
    if (!watching) return;
    const id = window.setInterval(() => {
      if (!playingRef.current) return;
      persistProgress(readTime());
    }, PROGRESS_SAVE_MS);
    return () => window.clearInterval(id);
  }, [watching, video.videoId, video.src]);

  useEffect(() => {
    setWatching((video.startAt ?? 0) > 1);
    syncPlaying(false);
    setResolvedTitle(null);
  }, [video.videoId, video.src]);

  // Caption under the player should be the YouTube video name, not the note title.
  useEffect(() => {
    if (!video.videoId) {
      setResolvedTitle(null);
      return;
    }
    const existing = video.title?.trim() ?? "";
    const note = noteTitle?.trim() ?? "";
    // Keep a real YouTube title; refetch when missing or still mirroring the note name.
    if (existing && existing !== note && existing !== "YouTube video" && existing !== "Video") {
      setResolvedTitle(existing);
      return;
    }
    let cancelled = false;
    void fetchYouTubeTitle(video.videoId).then((title) => {
      if (cancelled || !title) return;
      setResolvedTitle(title);
      if (video.title !== title) {
        onChangeRef.current({ ...videoAttrsRef.current, title });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [video.videoId, video.title, noteTitle]);

  useEffect(() => {
    if (resizeRef.current) return;
    setDraftWidth(null);
  }, [video.width, pip]);

  useEffect(() => {
    setDragPos(null);
  }, [video.pipCorner, pip]);

  useEffect(() => {
    if (resizeRef.current) return;
    const current = videoAttrsRef.current;
    if (pip) {
      if ((current.width || 0) <= pipMaxWidth) return;
      onChangeRef.current({ ...current, width: pipMaxWidth });
      return;
    }
    if (typeof dockMaxRatio !== "number" || (current.width || 0) <= dockMaxWidth) return;
    onChangeRef.current({ ...current, width: dockMaxWidth });
  }, [pip, pipMaxWidth, dockMaxRatio, dockMaxWidth, video.width]);

  const startWatching = () => {
    setWatching(true);
    if (video.src) {
      requestAnimationFrame(() => {
        const el = videoElRef.current;
        if (!el) return;
        const resumeAt = Math.max(0, videoAttrsRef.current.startAt || 0);
        if (resumeAt > 0) {
          try {
            el.currentTime = resumeAt;
          } catch {
            /* ignore seek errors */
          }
        }
        void el.play().then(() => syncPlaying(true)).catch(() => syncPlaying(false));
      });
    }
  };

  const clampWidth = (next: number, maxWidth: number) =>
    Math.round(Math.min(Math.max(next, STUDY_VIDEO_MIN_WIDTH), Math.max(STUDY_VIDEO_MIN_WIDTH, maxWidth)));

  const setPip = (next: boolean, corner: StudyVideoCorner = video.pipCorner || "br") => {
    // Keep this video's id so Dual can selectively PiP/dock the chosen player.
    onChange({
      ...video,
      id: video.id,
      pip: next,
      pipCorner: corner,
      width: next
        ? Math.min(Math.max(video.width, STUDY_VIDEO_MIN_WIDTH), STUDY_VIDEO_PIP_WIDTH)
        : Math.max(video.width, STUDY_VIDEO_PIP_WIDTH),
    });
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const parent = boundsRef?.current || shellRef.current?.parentElement;
    const parentWidth = parent?.clientWidth || STUDY_VIDEO_DEFAULT_WIDTH * 1.5;
    const parentHeight = parent?.clientHeight || STUDY_VIDEO_DEFAULT_WIDTH;
    // PiP stays inside the notes area; dual dock caps use dockMaxRatio (½ or ⅓ page).
    const maxWidth = pip
      ? pipMaxWidthFromBounds(parentWidth, parentHeight, stackCount)
      : typeof dockMaxRatio === "number" && dockMaxRatio > 0
        ? Math.max(STUDY_VIDEO_MIN_WIDTH, Math.floor(parentWidth * dockMaxRatio))
        : parentWidth;
    resizeRef.current = {
      startX: event.clientX,
      startWidth: width,
      maxWidth,
      current: width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = resizeRef.current;
    if (!drag) return;
    const raw = event.clientX - drag.startX;
    // Right-anchored PiP grows when dragging left; docked grows from center (2x).
    const delta = pip ? (anchoredRight ? -raw : raw) : raw * 2;
    const next = clampWidth(drag.startWidth + delta, drag.maxWidth);
    drag.current = next;
    setDraftWidth(next);
    if (pip) onChange({ ...video, width: next });
  };

  const onResizePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = resizeRef.current;
    if (!drag) return;
    const next = drag.current;
    resizeRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    setDraftWidth(null);
    const capped = pip ? Math.min(next, drag.maxWidth) : next;
    if (capped !== video.width) onChange({ ...video, width: capped });
  };

  const cornerOrigin = (
    corner: StudyVideoCorner,
    box: { width: number; height: number },
    frame: { width: number; height: number },
  ) => {
    if (corner === "tl") return { left: PIP_INSET, top: PIP_INSET };
    if (corner === "tr") return { left: box.width - frame.width - PIP_INSET, top: PIP_INSET };
    if (corner === "bl") return { left: PIP_INSET, top: box.height - frame.height - PIP_INSET };
    return { left: box.width - frame.width - PIP_INSET, top: box.height - frame.height - PIP_INSET };
  };

  const onMovePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pip || !boundsRef?.current || !shellRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const box = boundsRef.current.getBoundingClientRect();
    const frame = shellRef.current.getBoundingClientRect();
    // Dual stack: treat the full vertical stack as the move footprint so it stays in-bounds.
    const footprintHeight =
      stackIndex === 0 && stackCount > 1
        ? Math.min(box.height - PIP_INSET * 2, stackHeight)
        : frame.height;
    const origin =
      dragPos ??
      cornerOrigin(video.pipCorner, box, { width: frame.width, height: footprintHeight });
    moveRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      currentLeft: origin.left,
      currentTop: origin.top,
      width: frame.width,
      height: footprintHeight,
      boxWidth: box.width,
      boxHeight: box.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onMovePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = moveRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const left = Math.min(
      Math.max(PIP_INSET, drag.originLeft + (event.clientX - drag.startX)),
      drag.boxWidth - drag.width - PIP_INSET,
    );
    const top = Math.min(
      Math.max(PIP_INSET, drag.originTop + (event.clientY - drag.startY)),
      drag.boxHeight - drag.height - PIP_INSET,
    );
    drag.currentLeft = left;
    drag.currentTop = top;
    setDragPos({ left, top });
  };

  const onMovePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = moveRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    const corner = nearestCorner(
      drag.currentLeft,
      drag.currentTop,
      drag.width,
      drag.height,
      drag.boxWidth,
      drag.boxHeight,
    );
    setDragPos(null);
    if (corner !== video.pipCorner) onChange({ ...video, pipCorner: corner });
  };

  const applyLink = () => {
    const block = videoBlockFromLink(link, null);
    if (!block?.attrs) {
      setLinkError("Paste a video link, such as a YouTube URL.");
      return;
    }
    onChange(
      defaultStudyVideoAttrs({
        ...video,
        videoId: (block.attrs.videoId as string | null) ?? null,
        src: (block.attrs.src as string | null) ?? null,
        startAt: 0,
      }),
    );
    setLink("");
    setLinkError("");
    setChangeOpen(false);
  };

  const applyUpload = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setFileError("Choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setFileError("That video is larger than 12 MB. Paste a link instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) {
        setFileError("Could not read that video.");
        return;
      }
      onChange(
        defaultStudyVideoAttrs({
          ...video,
          videoId: null,
          src,
          title: video.title || file.name.replace(/\.[^.]+$/, "") || "Video",
          startAt: 0,
        }),
      );
      setFileError("");
      setChangeOpen(false);
    };
    reader.onerror = () => setFileError("Could not read that video.");
    reader.readAsDataURL(file);
  };

  const openChange = () => {
    setLink("");
    setLinkError("");
    setFileError("");
    setChangeOpen(true);
  };

  const shellStyle: CSSProperties = pip
    ? {
        width,
        maxWidth: "100%",
        ...(dragPos
          ? {
              position: "absolute",
              zIndex: 40 + stackIndex,
              left: dragPos.left,
              top:
                dragPos.top +
                (stackIndex > 0 ? Math.round((stackUnitWidth * 9) / 16) + STUDY_VIDEO_DUAL_GAP : 0),
              right: "auto",
              bottom: "auto",
            }
          : dualStackOffset(video.pipCorner, stackUnitWidth, stackIndex, PIP_INSET)),
      }
    : fillWidth
      ? { width: "100%", maxWidth: "100%" }
      : { width, maxWidth: "100%" };

  return (
    <div
      ref={shellRef}
      className={cn(
        "space-y-2",
        pip
          ? "rounded-xl shadow-xl ring-1 ring-border/50 backdrop-blur-sm"
          : // Side-by-side dual uses flex without mx-auto; one-at-a-time stays centered.
            typeof dockMaxRatio === "number"
            ? cn("relative w-full max-w-full", centerDock && "mx-auto")
            : "relative mx-auto w-full",
        fillWidth && !pip && "min-w-0",
        className,
      )}
      style={shellStyle}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            draggable={!pip}
            onDragStart={(event) => {
              if (pip || resizeRef.current || moveRef.current) {
                event.preventDefault();
                return;
              }
              beginDrag(event, { kind: "video", id: noteId, label: displayTitle });
              if (onLaneDragStart) {
                event.dataTransfer.setData("application/x-study-dual-lane", video.id);
                onLaneDragStart(video.id);
              }
            }}
            className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-neutral-900"
          >
            {watching ? (
              video.src ? (
                <video
                  ref={videoElRef}
                  className="pointer-events-auto h-full w-full bg-black"
                  src={video.src}
                  controls
                  playsInline
                  draggable={false}
                  onLoadedMetadata={(event) => {
                    const resumeAt = Math.max(0, videoAttrsRef.current.startAt || 0);
                    if (resumeAt > 0) {
                      try {
                        event.currentTarget.currentTime = resumeAt;
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                  onPlay={() => syncPlaying(true)}
                  onPause={(event) => {
                    syncPlaying(false);
                    persistProgress(event.currentTarget.currentTime || 0, true);
                  }}
                  onEnded={() => {
                    syncPlaying(false);
                    persistProgress(0, true);
                  }}
                />
              ) : (
                <div ref={ytMountRef} className="h-full w-full" />
              )
            ) : (
              <>
                {thumb ? (
                  <img src={thumb} alt="" draggable={false} className="h-full w-full object-cover opacity-90" />
                ) : video.src ? (
                  <video className="h-full w-full object-cover" src={video.src} muted preload="metadata" draggable={false} />
                ) : (
                  <div className="h-full w-full bg-neutral-800" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <button
                    type="button"
                    onClick={startWatching}
                    onPointerDown={(event) => event.stopPropagation()}
                    aria-label="Play video"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm ring-1 ring-border/60 transition hover:bg-background"
                  >
                    <Play className="h-5 w-5 fill-current" />
                  </button>
                </div>
              </>
            )}

            {isMain ? (
              <span
                title="Main video"
                aria-label="Main video"
                className="absolute left-1.5 top-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/85 text-foreground shadow-sm ring-1 ring-border/50"
              >
                <Star className="h-3.5 w-3.5 fill-current" />
              </span>
            ) : null}

            <button
              type="button"
              aria-label={pip ? "Dock video" : "Picture in picture"}
              title={pip ? "Dock video" : "Picture in picture"}
              draggable={false}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setPip(!pip)}
              className="absolute right-1.5 top-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/85 text-muted-foreground shadow-sm ring-1 ring-border/50 transition hover:bg-background hover:text-foreground"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>

            {pip ? (
              <button
                type="button"
                aria-label="Drag video"
                title="Drag to a corner"
                draggable={false}
                onPointerDown={onMovePointerDown}
                onPointerMove={onMovePointerMove}
                onPointerUp={onMovePointerUp}
                onPointerCancel={onMovePointerUp}
                className="absolute bottom-1.5 left-1.5 z-20 inline-flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm ring-1 ring-border/60 transition hover:bg-background active:cursor-grabbing"
              >
                <Grip className="h-4 w-4" />
              </button>
            ) : null}

            {!fillWidth ? (
              <button
                type="button"
                aria-label="Resize video"
                draggable={false}
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                onPointerCancel={onResizePointerUp}
                className={cn(
                  "absolute z-10 inline-flex touch-none cursor-nwse-resize items-center justify-center rounded-md bg-background/85 text-muted-foreground shadow-sm ring-1 ring-border/50 transition hover:bg-background hover:text-foreground",
                  pip ? "bottom-1.5 right-1.5 h-9 w-9" : "bottom-1.5 right-1.5 h-7 w-7",
                  anchoredRight && "cursor-nesw-resize",
                )}
              >
                <ArrowDownRight className={cn("h-3.5 w-3.5", anchoredRight && "scale-x-[-1]")} />
              </button>
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[11rem]">
          <ContextMenuItem onSelect={() => setPip(!pip)}>
            {pip ? "Dock to note" : "Picture in picture"}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onChange({ ...video, locked: !video.locked })}>
            {video.locked ? "Unlock" : "Lock"}
          </ContextMenuItem>
          <ContextMenuItem onSelect={openChange}>Change video</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={onRemove}
          >
            Remove video
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <p className="min-w-0 truncate text-[12px] text-muted-foreground" title={displayTitle}>
        {displayTitle}
      </p>

      <Dialog
        open={changeOpen}
        onOpenChange={(open) => {
          setChangeOpen(open);
          if (!open) {
            setLink("");
            setLinkError("");
            setFileError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change video</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={link}
                onChange={(event) => {
                  setLink(event.target.value);
                  setLinkError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
                placeholder="YouTube URL or video link"
                className="h-9 w-full rounded-lg border border-border/50 bg-background pl-8 pr-3 text-sm outline-none focus:border-primary/40"
              />
            </div>
            {linkError ? <p className="text-xs text-destructive">{linkError}</p> : null}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload a video
            </button>
            {fileError ? <p className="text-xs text-destructive">{fileError}</p> : null}
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) applyUpload(file);
              }}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={applyLink}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Use link
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
