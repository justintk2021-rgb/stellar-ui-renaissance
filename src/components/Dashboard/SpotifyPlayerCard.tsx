import { useEffect, useMemo, useRef, useState } from "react";
import {
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Link2,
  Unplug,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSharedSpotifyPlayer } from "@/hooks/SpotifyPlayerContext";
import { cn } from "@/lib/utils";

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const FAN_SLOTS = [-2, -1, 0, 1, 2] as const;
const FAN_BASE = 180;

/** Transform-only fan layout so the same card can morph between slots on the GPU. */
const FAN_STYLE: Record<
  (typeof FAN_SLOTS)[number],
  { scale: number; rotate: number; z: number; opacity: number; x: number }
> = {
  [-2]: { scale: 100 / FAN_BASE, rotate: -14, z: 1, opacity: 0.55, x: -148 },
  [-1]: { scale: 130 / FAN_BASE, rotate: -8, z: 2, opacity: 0.75, x: -78 },
  [0]: { scale: 1, rotate: 0, z: 3, opacity: 1, x: 0 },
  [1]: { scale: 130 / FAN_BASE, rotate: 8, z: 2, opacity: 0.75, x: 78 },
  [2]: { scale: 100 / FAN_BASE, rotate: 14, z: 1, opacity: 0.55, x: 148 },
};

export function SpotifyPlayerCard({ className }: { className?: string }) {
  const {
    isConfigured,
    isConnected,
    isReady,
    isPremium,
    premiumError,
    profile,
    currentTrack,
    isPlaying,
    volume,
    playlists,
    selectedPlaylistId,
    playlistTracks,
    shuffle,
    repeat,
    error,
    connect,
    disconnect,
    play,
    pause,
    next,
    previous,
    setVolume,
    seek,
    selectPlaylist,
    playTrack,
    toggleShuffle,
    cycleRepeat,
  } = useSharedSpotifyPlayer();

  const seekBarRef = useRef<HTMLDivElement>(null);
  const [songQuery, setSongQuery] = useState("");
  /** Instant fan center while Spotify playback state catches up. */
  const [fanCenterIdx, setFanCenterIdx] = useState<number | null>(null);
  const showPlayer = isConnected && isPremium !== false && !premiumError;
  const trimmedQuery = songQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  const selectedPlaylist = useMemo(
    () => playlists.find((item) => item.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );

  const progress = useMemo(() => {
    if (!currentTrack?.durationMs) return 0;
    return Math.min(100, (currentTrack.positionMs / currentTrack.durationMs) * 100);
  }, [currentTrack]);

  /** Index of the actually-playing track in the loaded playlist, or -1 if not in it. */
  const playingPlaylistIdx = useMemo(() => {
    if (!currentTrack || !playlistTracks.length) return -1;
    return playlistTracks.findIndex(
      (track) =>
        track.id === currentTrack.id ||
        track.uri === currentTrack.uri ||
        (currentTrack.uri && track.uri === currentTrack.uri),
    );
  }, [currentTrack, playlistTracks]);

  useEffect(() => {
    // Always snap the fan to whatever Spotify reports as playing.
    if (playingPlaylistIdx >= 0) setFanCenterIdx(playingPlaylistIdx);
    else setFanCenterIdx(null);
  }, [playingPlaylistIdx, currentTrack?.id, currentTrack?.uri]);

  useEffect(() => {
    setFanCenterIdx(null);
  }, [selectedPlaylistId]);

  const fanItems = useMemo(() => {
    type FanTrack = {
      id: string;
      name: string;
      artists: string;
      albumArt: string | null;
      uri: string;
      durationMs: number;
    };
    type FanItem = { offset: (typeof FAN_SLOTS)[number]; index: number; track: FanTrack };

    // Playing song isn't in this playlist — still show it as the center card.
    if (currentTrack && playingPlaylistIdx < 0) {
      return [
        {
          offset: 0 as const,
          index: -1,
          track: {
            id: currentTrack.id,
            name: currentTrack.name,
            artists: currentTrack.artists,
            albumArt: currentTrack.albumArt,
            uri: currentTrack.uri,
            durationMs: currentTrack.durationMs,
          },
        },
      ] satisfies FanItem[];
    }

    if (!playlistTracks.length) return [] as FanItem[];

    const centerIdx =
      fanCenterIdx != null
        ? Math.max(0, Math.min(playlistTracks.length - 1, fanCenterIdx))
        : playingPlaylistIdx >= 0
          ? playingPlaylistIdx
          : 0;

    return FAN_SLOTS.map((offset) => {
      const index = centerIdx + offset;
      if (index < 0 || index >= playlistTracks.length) return null;
      const track = playlistTracks[index];
      const isCenter = offset === 0;
      // Center card always mirrors live playback art/title when it matches.
      const live =
        isCenter &&
        currentTrack &&
        (currentTrack.id === track.id || currentTrack.uri === track.uri)
          ? currentTrack
          : null;
      return {
        offset,
        index,
        track: live
          ? {
              id: track.id,
              name: live.name,
              artists: live.artists,
              albumArt: live.albumArt ?? track.albumArt,
              uri: track.uri,
              durationMs: live.durationMs || track.durationMs,
            }
          : track,
      };
    }).filter((item): item is FanItem => Boolean(item));
  }, [currentTrack, fanCenterIdx, playingPlaylistIdx, playlistTracks]);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = trimmedQuery.toLowerCase();
    return playlistTracks.filter(
      (track) =>
        track.name.toLowerCase().includes(q) || track.artists.toLowerCase().includes(q),
    );
  }, [isSearching, playlistTracks, trimmedQuery]);

  // Metadata always follows live Spotify playback — never the optimistic fan position.
  const captionTrack = currentTrack;

  const jumpToFanIndex = (index: number) => {
    if (index < 0 || index >= playlistTracks.length) return;
    const track = playlistTracks[index];
    setFanCenterIdx(index);
    void playTrack(track.uri);
  };

  const goPrevious = () => {
    if (!shuffle && playlistTracks.length && playingPlaylistIdx >= 0) {
      setFanCenterIdx(Math.max(0, playingPlaylistIdx - 1));
    }
    void previous();
  };

  const goNext = () => {
    if (!shuffle && playlistTracks.length && playingPlaylistIdx >= 0) {
      setFanCenterIdx(Math.min(playlistTracks.length - 1, playingPlaylistIdx + 1));
    }
    void next();
  };

  const seekFromPointer = (clientX: number) => {
    if (!currentTrack || !seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    void seek(ratio * currentTrack.durationMs);
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border p-4 shadow-card",
        showPlayer
          ? "border-white/10 bg-[radial-gradient(ellipse_at_top,_#5b21b6_0%,_#312e81_45%,_#1e1b4b_100%)] text-white"
          : "glass border-border/40",
        className,
      )}
    >
      {!showPlayer ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Music2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Spotify</p>
              <p className="text-[11px] text-muted-foreground">
                {isConnected
                  ? profile?.display_name || profile?.email || "Connected"
                  : "Play your music in NSYNC"}
              </p>
            </div>
          </div>
          {isConnected ? (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={disconnect}>
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center justify-center gap-2">
            <Music2 className="h-5 w-5 text-white/90" />
            <p className="text-base font-semibold tracking-wide text-white">Spotify</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            onClick={disconnect}
          >
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      )}

      {!isConfigured ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/40 bg-muted/20 px-4 text-center">
          <p className="text-sm font-medium text-foreground">Spotify is not configured</p>
          <p className="text-xs text-muted-foreground">
            Add <code className="text-[11px]">VITE_SPOTIFY_CLIENT_ID</code> to enable Connect.
          </p>
        </div>
      ) : !isConnected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/40 bg-muted/20 px-4 text-center">
          <p className="text-sm text-muted-foreground">Connect your Spotify account to play music here.</p>
          <Button type="button" onClick={() => void connect()} className="gap-2">
            <Link2 className="h-4 w-4" />
            Connect Spotify
          </Button>
        </div>
      ) : isPremium === false || premiumError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-center">
          <p className="text-sm font-medium text-foreground">
            {premiumError || "Spotify Premium is needed for in-app playback"}
          </p>
          <p className="text-xs text-muted-foreground">
            Free Spotify accounts can connect, but full track playback requires Premium.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {playlists.length === 0 ? (
            <p className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">
              No playlists found on this account.
            </p>
          ) : (
            <Select
              value={selectedPlaylistId || undefined}
              onValueChange={(value) => {
                void selectPlaylist(value);
              }}
            >
              <SelectTrigger className="h-8 border-white/15 bg-white/10 text-xs text-white shadow-none focus:ring-white/30 [&>svg]:text-white/70">
                <SelectValue placeholder="Choose a playlist" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {playlists.map((playlist) => (
                  <SelectItem key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              value={songQuery}
              onChange={(event) => setSongQuery(event.target.value)}
              placeholder="Search songs in this playlist"
              disabled={!selectedPlaylistId}
              className="h-8 w-full rounded-lg border border-white/15 bg-white/10 py-1.5 pl-8 pr-8 text-xs text-white placeholder:text-white/40 shadow-none outline-none focus:border-white/30 focus:ring-1 focus:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {songQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSongQuery("")}
                className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>

          {isSearching ? (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
              {playlistTracks.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-white/55">
                  {error
                    ? error
                    : "Loading playlist songs… If this stays empty, re-select the playlist."}
                </p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-white/55">No songs match</p>
              ) : (
                <ul className="divide-y divide-white/10 p-1">
                  {searchResults.map((track) => (
                    <li key={track.id}>
                      <button
                        type="button"
                        disabled={!isReady}
                        onClick={() => {
                          const index = playlistTracks.findIndex((item) => item.id === track.id);
                          if (index >= 0) setFanCenterIdx(index);
                          void playTrack(track.uri);
                          setSongQuery("");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-white/10">
                          {track.albumArt ? (
                            <img src={track.albumArt} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Music2 className="h-3.5 w-3.5 text-white/40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">{track.name}</p>
                          <p className="truncate text-[10px] text-white/55">{track.artists}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="relative mx-auto flex h-[11.5rem] w-full max-w-md flex-1 items-center justify-center">
              {fanItems.length === 0 ? (
                <div className="flex h-[180px] w-[180px] items-center justify-center rounded-2xl border border-white/15 bg-white/5">
                  <Music2 className="h-10 w-10 text-white/40" />
                </div>
              ) : (
                fanItems.map(({ offset, index, track }) => {
                  const style = FAN_STYLE[offset];
                  const isCenter = offset === 0;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      disabled={!isReady || isCenter}
                      onClick={() => {
                        if (!isCenter) jumpToFanIndex(index);
                      }}
                      className={cn(
                        "absolute overflow-hidden rounded-2xl border border-white/20 shadow-2xl will-change-transform",
                        "transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        !isCenter && "cursor-pointer hover:brightness-110",
                        isCenter && "cursor-default ring-2 ring-white/30",
                      )}
                      style={{
                        width: FAN_BASE,
                        height: FAN_BASE,
                        zIndex: style.z,
                        opacity: style.opacity,
                        transform: `translate3d(${style.x}px,0,0) rotate(${style.rotate}deg) scale(${style.scale})`,
                      }}
                      aria-label={isCenter ? track.name : `Play ${track.name}`}
                    >
                      {track.albumArt ? (
                        <img
                          src={track.albumArt}
                          alt=""
                          draggable={false}
                          className="pointer-events-none h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-indigo-900/80">
                          <Music2 className="h-8 w-8 text-white/50" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {!isSearching ? (
            <div className="shrink-0 space-y-0.5 px-1 text-center">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
                {selectedPlaylist?.name || (isReady ? "Pick a playlist" : "Connecting player…")}
              </p>
              <p className="truncate text-sm font-semibold text-white">
                {captionTrack?.name || "Nothing playing yet"}
              </p>
              <p className="truncate text-xs text-white/65">{captionTrack?.artists || " "}</p>
            </div>
          ) : null}

          <div className="mt-auto shrink-0 space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="w-8 font-mono text-[10px] tabular-nums text-white/55">
                {formatMs(currentTrack?.positionMs ?? 0)}
              </span>
              <div
                ref={seekBarRef}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label="Seek"
                tabIndex={currentTrack ? 0 : -1}
                className={cn(
                  "group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20",
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
                  className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  style={{ left: `calc(${progress}% - 6px)` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-[10px] tabular-nums text-white/55">
                {formatMs(currentTrack?.durationMs ?? 0)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-2 py-1.5 backdrop-blur-md sm:gap-2 sm:px-3">
              <button
                type="button"
                onClick={() => void toggleShuffle()}
                disabled={!isReady}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  shuffle ? "text-emerald-300" : "text-white/70 hover:text-white",
                )}
                aria-label="Shuffle"
                aria-pressed={shuffle}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={goPrevious}
                disabled={!isReady}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
                aria-label="Previous"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void (isPlaying ? pause() : play())}
                disabled={!isReady}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-950 shadow transition hover:scale-105"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!isReady}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
                aria-label="Next"
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void cycleRepeat()}
                disabled={!isReady}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  repeat === "off" ? "text-white/70 hover:text-white" : "text-emerald-300",
                )}
                aria-label="Repeat"
                aria-pressed={repeat !== "off"}
              >
                {repeat === "track" ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
              </button>

              <div className="ml-1 flex min-w-0 flex-1 items-center gap-2 border-l border-white/10 pl-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-white/10">
                  {captionTrack?.albumArt ? (
                    <img src={captionTrack.albumArt} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music2 className="h-3.5 w-3.5 text-white/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{captionTrack?.name || "—"}</p>
                  <p className="truncate text-[10px] text-white/55">{captionTrack?.artists || " "}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              {volume <= 0.01 ? (
                <VolumeX className="h-4 w-4 shrink-0 text-white/60" />
              ) : (
                <Volume2 className="h-4 w-4 shrink-0 text-white/60" />
              )}
              <Slider
                value={[Math.round(volume * 100)]}
                max={100}
                step={1}
                onValueChange={(value) => void setVolume((value[0] ?? 0) / 100)}
                className="flex-1 [&_[role=slider]]:border-white [&_[role=slider]]:bg-white [&>span:first-child]:bg-white/25 [&>span:first-child>span]:bg-white"
                aria-label="Volume"
              />
            </div>
          </div>

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
