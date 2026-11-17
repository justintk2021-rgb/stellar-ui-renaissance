import { useMemo, useRef, useState } from "react";
import { Heart, Music2, Pause, Play, Share2, SkipBack, SkipForward } from "lucide-react";
import { useSharedSpotifyPlayer } from "@/hooks/SpotifyPlayerContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRemaining(positionMs: number, durationMs: number) {
  const left = Math.max(0, durationMs - positionMs);
  return `-${formatMs(left)}`;
}

export function SidebarMusicPlayer({ className }: { className?: string }) {
  const {
    isConfigured,
    isConnected,
    isReady,
    currentTrack,
    isPlaying,
    profile,
    connect,
    play,
    pause,
    next,
    previous,
    seek,
  } = useSharedSpotifyPlayer();

  const seekRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(false);

  const progress = useMemo(() => {
    if (!currentTrack?.durationMs) return 0;
    return Math.min(100, (currentTrack.positionMs / currentTrack.durationMs) * 100);
  }, [currentTrack]);

  const art = currentTrack?.albumArt;
  const artistName = currentTrack?.artists?.split(",")[0]?.trim() || profile?.display_name || "Spotify";
  const handle =
    currentTrack?.artists
      ? `@${artistName.replace(/\s+/g, "").toLowerCase().slice(0, 14)}`
      : profile?.display_name
        ? `@${profile.display_name.replace(/\s+/g, "").toLowerCase().slice(0, 14)}`
        : "@spotify";

  const seekFromPointer = (clientX: number) => {
    if (!currentTrack || !seekRef.current) return;
    const rect = seekRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    void seek(ratio * currentTrack.durationMs);
  };

  const shareTrack = async () => {
    const url = currentTrack?.id
      ? `https://open.spotify.com/track/${currentTrack.id}`
      : "https://open.spotify.com";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Track link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (!isConfigured) return null;

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => void connect()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl border border-border/40 bg-muted/30 px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
          className,
        )}
      >
        <Music2 className="h-3.5 w-3.5" />
        Connect Spotify
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-[1.35rem] border-[3px] border-neutral-950 bg-neutral-950 shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {art ? (
        <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-800 via-indigo-950 to-neutral-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75" />

      <div className="relative z-[1] flex h-full flex-col justify-between p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 max-w-[70%] items-center gap-2 rounded-full bg-black/35 py-1 pl-1 pr-2.5 backdrop-blur-md">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
              {art ? (
                <img src={art} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music2 className="h-3 w-3 text-white/70" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold leading-tight text-white">
                {currentTrack?.name || artistName}
              </p>
              <p className="truncate text-[9px] leading-tight text-white/65">{handle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void shareTrack()}
              aria-label="Share track"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition hover:bg-black/50"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              aria-label={liked ? "Unlike" : "Like"}
              aria-pressed={liked}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition hover:bg-black/50",
                liked ? "text-rose-400" : "text-white/90",
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="space-y-1 px-0.5">
            <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-white/85">
              <span>{formatMs(currentTrack?.positionMs ?? 0)}</span>
              <span>{formatRemaining(currentTrack?.positionMs ?? 0, currentTrack?.durationMs ?? 0)}</span>
            </div>
            <div
              ref={seekRef}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              tabIndex={currentTrack ? 0 : -1}
              className={cn(
                "group relative h-[3px] cursor-pointer rounded-full bg-white/30",
                !currentTrack && "pointer-events-none opacity-50",
              )}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                seekFromPointer(event.clientX);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                seekFromPointer(event.clientX);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pb-0.5">
            <button
              type="button"
              onClick={() => void previous()}
              disabled={!isReady}
              aria-label="Previous"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30 disabled:opacity-40"
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            <button
              type="button"
              onClick={() => void (isPlaying ? pause() : play())}
              disabled={!isReady}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30 disabled:opacity-40"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current pl-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void next()}
              disabled={!isReady}
              aria-label="Next"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30 disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
