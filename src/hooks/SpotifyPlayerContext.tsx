import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

type SpotifyPlayerApi = ReturnType<typeof useSpotifyPlayer> & {
  isPanelOpen: boolean;
  openSpotifyPanel: () => void;
  setSpotifyPanelOpen: (open: boolean) => void;
};

const SpotifyPlayerContext = createContext<SpotifyPlayerApi | null>(null);

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const api = useSpotifyPlayer();
  const [isPanelOpen, setSpotifyPanelOpen] = useState(false);

  const openSpotifyPanel = useCallback(() => {
    setSpotifyPanelOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      ...api,
      isPanelOpen,
      openSpotifyPanel,
      setSpotifyPanelOpen,
    }),
    [api, isPanelOpen, openSpotifyPanel],
  );

  return <SpotifyPlayerContext.Provider value={value}>{children}</SpotifyPlayerContext.Provider>;
}

export function useSharedSpotifyPlayer() {
  const ctx = useContext(SpotifyPlayerContext);
  if (!ctx) {
    throw new Error("useSharedSpotifyPlayer must be used within SpotifyPlayerProvider");
  }
  return ctx;
}
