import { useMemo, useState } from "react";
import {
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Link2,
  Unplug,
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
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { cn } from "@/lib/utils";

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
    error,
    connect,
    disconnect,
    play,
    pause,
    next,
    previous,
    setVolume,
    seek,
    playPlaylist,
  } = useSpotifyPlayer();

  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");

  const progress = useMemo(() => {
    if (!currentTrack?.durationMs) return 0;
    return Math.min(100, (currentTrack.positionMs / currentTrack.durationMs) * 100);
  }, [currentTrack]);

  return (
    <div
      className={cn(
        "glass flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-border/40 p-4 shadow-card",
        className,
      )}
    >
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
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/40">
              {currentTrack?.albumArt ? (
                <img src={currentTrack.albumArt} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Music2 className="h-8 w-8 opacity-50" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {currentTrack ? (
                <>
                  <p className="truncate text-base font-semibold text-foreground">{currentTrack.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{currentTrack.artists}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">Nothing playing yet</p>
                  <p className="text-sm text-muted-foreground">
                    {isReady ? "Pick a playlist to start." : "Connecting player…"}
                  </p>
                </>
              )}

              <div className="mt-3 space-y-1.5">
                <Slider
                  value={[progress]}
                  max={100}
                  step={0.1}
                  disabled={!currentTrack}
                  onValueChange={(value) => {
                    if (!currentTrack) return;
                    const next = ((value[0] ?? 0) / 100) * currentTrack.durationMs;
                    void seek(next);
                  }}
                />
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span>{formatMs(currentTrack?.positionMs ?? 0)}</span>
                  <span>{formatMs(currentTrack?.durationMs ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => void previous()} disabled={!isReady}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={() => void (isPlaying ? pause() : play())}
              disabled={!isReady}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => void next()} disabled={!isReady}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {volume <= 0.01 ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
            <Slider
              value={[Math.round(volume * 100)]}
              max={100}
              step={1}
              onValueChange={(value) => void setVolume((value[0] ?? 0) / 100)}
              className="flex-1"
            />
          </div>

          {playlists.length === 0 ? (
            <p className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              No playlists found on this account.
            </p>
          ) : (
            <Select
              value={selectedPlaylist || undefined}
              onValueChange={(value) => {
                setSelectedPlaylist(value);
                const playlist = playlists.find((item) => item.id === value);
                if (playlist?.uri) void playPlaylist(playlist.uri);
              }}
            >
              <SelectTrigger className="h-9 bg-background/40">
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

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
