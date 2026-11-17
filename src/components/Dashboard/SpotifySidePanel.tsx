import { Music2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SpotifyPlayerCard } from "@/components/Dashboard/SpotifyPlayerCard";
import { useSharedSpotifyPlayer } from "@/hooks/SpotifyPlayerContext";

/** Shared Spotify drawer — opened from avatar menu, sidebar vinyl, etc. */
export function SpotifySidePanel() {
  const { isPanelOpen, setSpotifyPanelOpen } = useSharedSpotifyPlayer();

  return (
    <Sheet open={isPanelOpen} onOpenChange={setSpotifyPanelOpen}>
      <SheetContent
        side="right"
        className="w-full border-border/40 p-0 sm:max-w-[24rem] liquid-glass"
      >
        <SheetHeader className="border-b border-border/30 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music2 className="h-4 w-4 text-primary" />
            Spotify
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-4">
          <SpotifyPlayerCard className="min-h-[min(70vh,36rem)]" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
