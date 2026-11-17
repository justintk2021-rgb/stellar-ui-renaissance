import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginSpotifyLogin,
  clearSpotifyTokens,
  getDevices,
  getPlaybackState,
  getPlaylists,
  getPlaylistTracks,
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
  setRepeat as setRepeatApi,
  setShuffle as setShuffleApi,
  supportsSpotifyWebPlayback,
  transferPlayback,
  type SpotifyPlaybackState,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrack,
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

export type SpotifyRepeatMode = "off" | "track" | "context";

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

function repeatFromMode(mode: number | undefined): SpotifyRepeatMode {
  if (mode === 2) return "track";
  if (mode === 1) return "context";
  return "off";
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
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyPlaylistTrack[]>([]);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<SpotifyRepeatMode>("off");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<"sdk" | "connect" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const selectedPlaylistIdRef = useRef<string | null>(null);
  const playlistsRef = useRef<SpotifyPlaylist[]>([]);
  const connectPollRef = useRef<number | null>(null);
  const playbackModeRef = useRef<"sdk" | "connect" | null>(null);

  useEffect(() => {
    selectedPlaylistIdRef.current = selectedPlaylistId;
  }, [selectedPlaylistId]);

  useEffect(() => {
    playlistsRef.current = playlists;
  }, [playlists]);

  useEffect(() => {
    playbackModeRef.current = playbackMode;
  }, [playbackMode]);

  const stopConnectPoll = useCallback(() => {
    if (connectPollRef.current != null) {
      window.clearInterval(connectPollRef.current);
      connectPollRef.current = null;
    }
  }, []);

  const applyRemotePlaybackState = useCallback((state: SpotifyPlaybackState | undefined) => {
    if (!state) {
      setIsPlaying(false);
      return;
    }
    if (state.device?.id) {
      deviceIdRef.current = state.device.id;
      setDeviceId(state.device.id);
    }
    const item = state.item;
    if (item) {
      setCurrentTrack({
        id: item.id,
        name: item.name,
        artists: (item.artists || []).map((a) => a.name).join(", "),
        albumArt: item.album?.images?.[0]?.url ?? null,
        uri: item.uri,
        durationMs: item.duration_ms ?? 0,
        positionMs: state.progress_ms ?? 0,
      });
    }
    setIsPlaying(Boolean(state.is_playing));
    if (typeof state.shuffle_state === "boolean") setShuffleState(state.shuffle_state);
    if (state.repeat_state) setRepeatState(state.repeat_state);
  }, []);

  const syncRemotePlayback = useCallback(async () => {
    try {
      const state = await getPlaybackState();
      applyRemotePlaybackState(state);
      if (!state?.device) {
        const devices = await getDevices();
        const active = devices.find((device) => device.is_active && device.id) ?? devices.find((device) => device.id);
        if (active?.id) {
          deviceIdRef.current = active.id;
          setDeviceId(active.id);
          setStatusMessage(`Controlling ${active.name}`);
        } else {
          setStatusMessage("Open Spotify on your phone or desktop, then press play.");
        }
      } else if (state.device.name) {
        setStatusMessage(`Playing on ${state.device.name}`);
      }
    } catch {
      // Keep last known state; next poll retries.
    }
  }, [applyRemotePlaybackState]);

  const inBrowserHint = useCallback(() => {
    const origin = window.location.origin;
    return `Open ${origin} in Chrome or Edge for in-browser playback (no phone needed). This preview can’t create a Spotify player device.`;
  }, []);

  const isNoActiveDeviceError = useCallback((message: string) => {
    return /no active device|NO_ACTIVE_DEVICE|Device not found|404/i.test(message);
  }, []);

  const startConnectMode = useCallback(async () => {
    stopConnectPoll();
    playerRef.current?.disconnect();
    playerRef.current = null;
    setPlaybackMode("connect");
    setError(null);
    setIsReady(true);
    setStatusMessage(inBrowserHint());
    await syncRemotePlayback();
    connectPollRef.current = window.setInterval(() => {
      void syncRemotePlayback();
    }, 2500);
  }, [inBrowserHint, stopConnectPoll, syncRemotePlayback]);

  const disconnect = useCallback(() => {
    stopConnectPoll();
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
    setSelectedPlaylistId(null);
    setPlaylistTracks([]);
    setShuffleState(false);
    setRepeatState("off");
    setDeviceId(null);
    setError(null);
    setPlaybackMode(null);
    setStatusMessage(null);
  }, [stopConnectPoll]);

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

  const applyPlayerState = useCallback((state: any) => {
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
    if (typeof state.shuffle === "boolean") setShuffleState(state.shuffle);
    if (state.repeat_mode != null) setRepeatState(repeatFromMode(state.repeat_mode));
  }, []);

  const initPlayer = useCallback(async () => {
    if (!getStoredTokens()) {
      setIsConnected(false);
      return;
    }
    setIsConnected(true);
    setError(null);
    setStatusMessage(null);

    try {
      const { premium } = await refreshProfileAndPlaylists();
      if (!premium) {
        setIsReady(false);
        return;
      }

      // Prefer the Web Playback SDK so this tab is the device (no phone needed).
      // Cursor / Electron previews lack Widevine — SDK init fails and we fall back.
      const canUseSdk = await supportsSpotifyWebPlayback();
      if (!canUseSdk) {
        await startConnectMode();
        return;
      }

      await loadSpotifySdk();
      if (!window.Spotify) {
        await startConnectMode();
        return;
      }

      stopConnectPoll();
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
        setPlaybackMode("sdk");
        setStatusMessage(null);
        setError(null);
        void transferPlayback(device_id, true).catch(() => {
          // Device transfer can 404 briefly before Spotify registers the device.
        });
        void player.getCurrentState().then((state) => applyPlayerState(state)).catch(() => undefined);
      });

      player.addListener("not_ready", () => {
        setIsReady(false);
      });

      player.addListener("account_error", () => {
        setIsPremium(false);
        setPremiumError("Spotify Premium is needed for in-app playback");
        setIsReady(false);
      });

      player.addListener("initialization_error", () => {
        void startConnectMode();
      });

      player.addListener("authentication_error", ({ message }: { message: string }) => {
        setError(message || "Spotify authentication failed");
      });

      player.addListener("player_state_changed", (state: any) => {
        applyPlayerState(state);
      });

      const ok = await player.connect();
      if (!ok) await startConnectMode();
    } catch (err) {
      try {
        await startConnectMode();
      } catch {
        setError(err instanceof Error ? err.message : "Spotify connection failed");
      }
    }
  }, [applyPlayerState, refreshProfileAndPlaylists, startConnectMode, stopConnectPoll, volume]);

  useEffect(() => {
    if (!isSpotifyConnected()) return;
    void initPlayer();
    return () => {
      stopConnectPoll();
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

  useEffect(() => {
    if (!selectedPlaylistId || !isConnected) {
      setPlaylistTracks([]);
      return;
    }
    let cancelled = false;
    setPlaylistTracks([]);
    void getPlaylistTracks(selectedPlaylistId)
      .then((tracks) => {
        if (cancelled) return;
        setPlaylistTracks(tracks);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlaylistTracks([]);
        const raw = err instanceof Error ? err.message : "Could not load playlist songs";
        const message =
          /403|forbidden/i.test(raw)
            ? "Spotify blocked song list for this playlist. Try one you own or created."
            : raw;
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylistId, isConnected]);

  const ensureActiveDevice = useCallback(async () => {
    if (deviceIdRef.current && playbackModeRef.current === "sdk") return deviceIdRef.current;
    const devices = await getDevices();
    const active =
      devices.find((device) => device.is_active && device.id) ?? devices.find((device) => device.id);
    if (active?.id) {
      deviceIdRef.current = active.id;
      setDeviceId(active.id);
      await transferPlayback(active.id, false).catch(() => undefined);
      return active.id;
    }
    return null;
  }, []);

  const play = useCallback(async () => {
    if (playerRef.current && playbackModeRef.current === "sdk") {
      await playerRef.current.resume();
      return;
    }
    const id = (await ensureActiveDevice()) || deviceIdRef.current;
    try {
      await playUri({ deviceId: id || undefined });
      setError(null);
      if (playbackModeRef.current === "connect") void syncRemotePlayback();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resume playback";
      if (isNoActiveDeviceError(message)) {
        setError(null);
        setStatusMessage(inBrowserHint());
      } else {
        setError(message);
      }
    }
  }, [ensureActiveDevice, inBrowserHint, isNoActiveDeviceError, syncRemotePlayback]);

  const pause = useCallback(async () => {
    if (playerRef.current && playbackModeRef.current === "sdk") {
      await playerRef.current.pause();
      return;
    }
    await pausePlayback(deviceIdRef.current || undefined).catch(() => undefined);
    if (playbackModeRef.current === "connect") void syncRemotePlayback();
  }, [syncRemotePlayback]);

  const next = useCallback(async () => {
    if (playerRef.current && playbackModeRef.current === "sdk") {
      await playerRef.current.nextTrack();
      return;
    }
    await nextTrack(deviceIdRef.current || undefined).catch(() => undefined);
    if (playbackModeRef.current === "connect") void syncRemotePlayback();
  }, [syncRemotePlayback]);

  const previous = useCallback(async () => {
    if (playerRef.current && playbackModeRef.current === "sdk") {
      await playerRef.current.previousTrack();
      return;
    }
    await previousTrack(deviceIdRef.current || undefined).catch(() => undefined);
    if (playbackModeRef.current === "connect") void syncRemotePlayback();
  }, [syncRemotePlayback]);

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
    const id = (await ensureActiveDevice()) || deviceIdRef.current;
    if (id && playbackModeRef.current === "sdk") {
      await transferPlayback(id, true).catch(() => undefined);
    }
    try {
      await playUri({ deviceId: id || undefined, context_uri: playlistUri });
      setError(null);
      if (playbackModeRef.current === "connect") void syncRemotePlayback();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start playback";
      if (isNoActiveDeviceError(message)) {
        setError(null);
        setStatusMessage(inBrowserHint());
      } else {
        setError(message);
      }
    }
  }, [ensureActiveDevice, inBrowserHint, isNoActiveDeviceError, syncRemotePlayback]);

  const selectPlaylist = useCallback(
    async (playlistId: string) => {
      setSelectedPlaylistId(playlistId);
      const playlist = playlistsRef.current.find((item) => item.id === playlistId);
      if (playlist?.uri) await playPlaylist(playlist.uri);
    },
    [playPlaylist],
  );

  const playTrack = useCallback(async (uri: string) => {
    const id = (await ensureActiveDevice()) || deviceIdRef.current;
    const playlist = playlistsRef.current.find((item) => item.id === selectedPlaylistIdRef.current);
    if (id && playbackModeRef.current === "sdk") {
      await transferPlayback(id, true).catch(() => undefined);
    }
    try {
      if (playlist?.uri) {
        await playUri({
          deviceId: id || undefined,
          context_uri: playlist.uri,
          offset: { uri },
        });
      } else {
        await playUri({ deviceId: id || undefined, uris: [uri] });
      }
      setError(null);
      if (playbackModeRef.current === "connect") void syncRemotePlayback();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start playback";
      if (isNoActiveDeviceError(message)) {
        setError(null);
        setStatusMessage(inBrowserHint());
      } else {
        setError(message);
      }
    }
  }, [ensureActiveDevice, inBrowserHint, isNoActiveDeviceError, syncRemotePlayback]);

  const toggleShuffle = useCallback(async () => {
    const nextState = !shuffle;
    setShuffleState(nextState);
    await setShuffleApi(nextState, deviceIdRef.current || undefined).catch(() => {
      setShuffleState(shuffle);
    });
  }, [shuffle]);

  const cycleRepeat = useCallback(async () => {
    const nextMode: SpotifyRepeatMode =
      repeat === "off" ? "context" : repeat === "context" ? "track" : "off";
    setRepeatState(nextMode);
    await setRepeatApi(nextMode, deviceIdRef.current || undefined).catch(() => {
      setRepeatState(repeat);
    });
  }, [repeat]);

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
    selectedPlaylistId,
    playlistTracks,
    shuffle,
    repeat,
    deviceId,
    error,
    playbackMode,
    statusMessage,
    connect,
    disconnect,
    play,
    pause,
    next,
    previous,
    setVolume,
    seek,
    playPlaylist,
    selectPlaylist,
    playTrack,
    toggleShuffle,
    cycleRepeat,
    refresh: initPlayer,
  };
}
