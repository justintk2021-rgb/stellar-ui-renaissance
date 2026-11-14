import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginSpotifyLogin,
  clearSpotifyTokens,
  getPlaylists,
  getSpotifyProfile,
  getStoredTokens,
  getValidAccessToken,
  isSpotifyConfigured,
  isSpotifyConnected,
  nextTrack,
  pausePlayback,
  playUri,
  previousTrack,
  seekPlayback,
  setPlayerVolume,
  transferPlayback,
  type SpotifyPlaylist,
  type SpotifyProfile,
} from "@/lib/spotify";

export type SpotifyTrackInfo = {
  id: string;
  name: string;
  artists: string;
  albumArt: string | null;
  uri: string;
  durationMs: number;
  positionMs: number;
};

type SpotifyPlayerInstance = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: any) => void) => void;
  removeListener: (event: string, cb?: (payload: any) => void) => void;
  getCurrentState: () => Promise<any>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

let sdkLoader: Promise<void> | null = null;

function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve();
  if (sdkLoader) return sdkLoader;
  sdkLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-spotify-sdk="1"]');
    if (existing) {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      if (window.Spotify) resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.dataset.spotifySdk = "1";
    script.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK"));
    document.body.appendChild(script);
  });
  return sdkLoader;
}

export function useSpotifyPlayer() {
  const [isConnected, setIsConnected] = useState(() => isSpotifyConnected());
  const [isReady, setIsReady] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    clearSpotifyTokens();
    setIsConnected(false);
    setIsReady(false);
    setIsPremium(null);
    setPremiumError(null);
    setProfile(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    setPlaylists([]);
    setDeviceId(null);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    if (!isSpotifyConfigured()) {
      setError("Add VITE_SPOTIFY_CLIENT_ID to enable Spotify.");
      return;
    }
    await beginSpotifyLogin();
  }, []);

  const refreshProfileAndPlaylists = useCallback(async () => {
    const [me, lists] = await Promise.all([getSpotifyProfile(), getPlaylists()]);
    setProfile(me);
    setPlaylists(lists);
    const premium = (me.product || "").toLowerCase() === "premium";
    setIsPremium(premium);
    if (!premium) {
      setPremiumError("Spotify Premium is needed for in-app playback");
    } else {
      setPremiumError(null);
    }
    return { me, premium };
  }, []);

  const initPlayer = useCallback(async () => {
    if (!getStoredTokens()) {
      setIsConnected(false);
      return;
    }
    setIsConnected(true);
    setError(null);

    try {
      const { premium } = await refreshProfileAndPlaylists();
      if (!premium) {
        setIsReady(false);
        return;
      }

      await loadSpotifySdk();
      if (!window.Spotify) throw new Error("Spotify SDK unavailable");

      playerRef.current?.disconnect();
      const player = new window.Spotify.Player({
        name: "NSYNC Journal",
        getOAuthToken: (cb) => {
          void getValidAccessToken()
            .then((token) => cb(token))
            .catch(() => cb(""));
        },
        volume,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setIsReady(true);
        void transferPlayback(device_id, false).catch(() => {
          // Device transfer can 404 briefly before Spotify registers the device.
        });
      });

      player.addListener("not_ready", () => {
        setIsReady(false);
      });

      player.addListener("account_error", () => {
        setIsPremium(false);
        setPremiumError("Spotify Premium is needed for in-app playback");
        setIsReady(false);
      });

      player.addListener("initialization_error", ({ message }: { message: string }) => {
        setError(message || "Could not initialize Spotify player");
      });

      player.addListener("authentication_error", ({ message }: { message: string }) => {
        setError(message || "Spotify authentication failed");
      });

      player.addListener("player_state_changed", (state: any) => {
        if (!state) {
          setIsPlaying(false);
          return;
        }
        const track = state.track_window?.current_track;
        if (track) {
          setCurrentTrack({
            id: track.id,
            name: track.name,
            artists: (track.artists || []).map((a: { name: string }) => a.name).join(", "),
            albumArt: track.album?.images?.[0]?.url ?? null,
            uri: track.uri,
            durationMs: track.duration_ms ?? 0,
            positionMs: state.position ?? 0,
          });
        }
        setIsPlaying(!state.paused);
      });

      const ok = await player.connect();
      if (!ok) setError("Could not connect Spotify player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spotify connection failed");
    }
  }, [refreshProfileAndPlaylists, volume]);

  useEffect(() => {
    if (!isSpotifyConnected()) return;
    void initPlayer();
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
    // Mount once per connected session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    const id = window.setInterval(() => {
      void getValidAccessToken().catch(() => {
        // Token refresh failed — leave UI connected until next API call surfaces it.
      });
    }, 45_000);
    return () => window.clearInterval(id);
  }, [isConnected]);

  const play = useCallback(async () => {
    const id = deviceIdRef.current;
    if (playerRef.current) {
      await playerRef.current.resume();
      return;
    }
    await playUri({ deviceId: id || undefined });
  }, []);

  const pause = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.pause();
      return;
    }
    await pausePlayback(deviceIdRef.current || undefined);
  }, []);

  const next = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.nextTrack();
      return;
    }
    await nextTrack(deviceIdRef.current || undefined);
  }, []);

  const previous = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.previousTrack();
      return;
    }
    await previousTrack(deviceIdRef.current || undefined);
  }, []);

  const setVolume = useCallback(async (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolumeState(clamped);
    if (playerRef.current) {
      await playerRef.current.setVolume(clamped);
    }
    await setPlayerVolume(clamped * 100, deviceIdRef.current || undefined).catch(() => undefined);
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    if (playerRef.current) {
      await playerRef.current.seek(positionMs);
    }
    await seekPlayback(positionMs, deviceIdRef.current || undefined).catch(() => undefined);
    setCurrentTrack((track) => (track ? { ...track, positionMs } : track));
  }, []);

  const playPlaylist = useCallback(async (playlistUri: string) => {
    const id = deviceIdRef.current;
    if (id) {
      await transferPlayback(id, false).catch(() => undefined);
    }
    await playUri({ deviceId: id || undefined, context_uri: playlistUri });
  }, []);

  return {
    isConfigured: isSpotifyConfigured(),
    isConnected,
    isReady,
    isPremium,
    premiumError,
    profile,
    currentTrack,
    isPlaying,
    volume,
    playlists,
    deviceId,
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
    refresh: initPlayer,
  };
}
