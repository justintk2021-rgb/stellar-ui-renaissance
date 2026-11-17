import { Music2 } from "lucide-react";
import { useSharedSpotifyPlayer } from "@/hooks/SpotifyPlayerContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Compact vinyl disc for icons-only sidebar — album art + white spindle, synced to Spotify. */
export function SidebarRecordPlayer({ className }: { className?: string }) {
  const {
    isConfigured,
    isConnected,
    currentTrack,
    isPlaying,
    connect,
    openSpotifyPanel,
  } = useSharedSpotifyPlayer();

  if (!isConfigured) return null;

  const art = currentTrack?.albumArt;
  const title = currentTrack?.name || "Nothing playing";
  const artists = currentTrack?.artists || "Spotify";

  const disc = (
    <button
      type="button"
      onClick={() => {
        if (!isConnected) {
          void connect();
          return;
        }
        openSpotifyPanel();
      }}
      aria-label={!isConnected ? "Connect Spotify" : "Open Spotify player"}
      className={cn(
        "relative mx-auto block h-11 w-11 overflow-hidden rounded-full",
        "shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-1 ring-black/20",
        "transition-transform hover:scale-105",
        isPlaying && "animate-vinyl-spin",
        className,
      )}
    >
      {art ? (
        <img src={art} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-700 via-indigo-800 to-violet-950">
          <Music2 className="h-4 w-4 text-white/80" />
        </span>
      )}
      {/* White spindle hole */}
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
      />
    </button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{disc}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="max-w-[12rem]">
          {!isConnected ? (
            <p className="text-xs">Connect Spotify</p>
          ) : (
            <div className="space-y-0.5">
              <p className="truncate text-xs font-medium">{title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{artists}</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
