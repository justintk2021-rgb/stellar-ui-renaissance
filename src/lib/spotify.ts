const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "user-library-read",
].join(" ");

const STORAGE = {
  access: "nsync_spotify_access_token",
  refresh: "nsync_spotify_refresh_token",
  expiry: "nsync_spotify_token_expiry",
  verifier: "nsync_spotify_code_verifier",
  state: "nsync_spotify_oauth_state",
} as const;

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type SpotifyProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  product: string | null;
  images?: { url: string }[];
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  uri: string;
};

const CONNECT_RESUME_PARAM = "spotify_connect";

function isLocalhostOrigin(origin = window.location.origin) {
  return /^http:\/\/localhost(?=:\d+|\/|$)/i.test(origin);
}

function redirectUri() {
  // Spotify disallows "localhost" — loopback must use an explicit IP (127.0.0.1 / ::1).
  const origin = isLocalhostOrigin()
    ? window.location.origin.replace(/^http:\/\/localhost/i, "http://127.0.0.1")
    : window.location.origin;
  return `${origin}/spotify-callback`;
}

function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isSpotifyConfigured() {
  return Boolean(CLIENT_ID?.trim());
}

export function getStoredTokens(): SpotifyTokens | null {
  const accessToken = localStorage.getItem(STORAGE.access);
  const refreshToken = localStorage.getItem(STORAGE.refresh);
  const expiryRaw = localStorage.getItem(STORAGE.expiry);
  if (!accessToken || !refreshToken || !expiryRaw) return null;
  const expiresAt = Number(expiryRaw);
  if (!Number.isFinite(expiresAt)) return null;
  return { accessToken, refreshToken, expiresAt };
}

export function storeTokens(tokens: SpotifyTokens) {
  localStorage.setItem(STORAGE.access, tokens.accessToken);
  localStorage.setItem(STORAGE.refresh, tokens.refreshToken);
  localStorage.setItem(STORAGE.expiry, String(tokens.expiresAt));
}

export function clearSpotifyTokens() {
  Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
}

export function isSpotifyConnected() {
  return Boolean(getStoredTokens()?.refreshToken);
}

/**
 * Spotify forbids localhost redirect URIs, so we rewrite to 127.0.0.1.
 * PKCE state/verifier live in localStorage, which is origin-scoped — starting
 * OAuth on localhost and landing on 127.0.0.1 causes "Invalid OAuth state".
 * Hop to 127.0.0.1 first (same path + ?spotify_connect=1), then resume.
 */
export async function beginSpotifyLogin() {
  if (!CLIENT_ID?.trim()) {
    throw new Error("Missing VITE_SPOTIFY_CLIENT_ID");
  }

  if (isLocalhostOrigin()) {
    const url = new URL(window.location.href);
    url.hostname = "127.0.0.1";
    url.searchParams.set(CONNECT_RESUME_PARAM, "1");
    window.location.replace(url.toString());
    return;
  }

  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = await sha256Base64Url(verifier);
  localStorage.setItem(STORAGE.verifier, verifier);
  localStorage.setItem(STORAGE.state, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

/** Call once on app boot to finish a localhost → 127.0.0.1 connect hop. */
export async function resumePendingSpotifyLogin() {
  const params = new URLSearchParams(window.location.search);
  if (params.get(CONNECT_RESUME_PARAM) !== "1") return;
  params.delete(CONNECT_RESUME_PARAM);
  const cleaned = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", cleaned);
  await beginSpotifyLogin();
}

async function tokenRequest(body: URLSearchParams) {
  if (!CLIENT_ID?.trim()) throw new Error("Missing VITE_SPOTIFY_CLIENT_ID");
  body.set("client_id", CLIENT_ID);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token request failed");
  }
  const expiresAt = Date.now() + Number(data.expires_in ?? 3600) * 1000 - 60_000;
  const existing = getStoredTokens();
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || existing?.refreshToken || "",
    expiresAt,
  };
  if (!tokens.refreshToken) throw new Error("No refresh token returned");
  storeTokens(tokens);
  return tokens;
}

export async function exchangeCodeForTokens(code: string, state: string) {
  const expectedState = localStorage.getItem(STORAGE.state);
  const verifier = localStorage.getItem(STORAGE.verifier);
  if (!expectedState || state !== expectedState) {
    throw new Error("Invalid OAuth state");
  }
  if (!verifier) throw new Error("Missing PKCE verifier");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const tokens = await tokenRequest(body);
  localStorage.removeItem(STORAGE.verifier);
  localStorage.removeItem(STORAGE.state);
  return tokens;
}

export async function refreshAccessToken() {
  const current = getStoredTokens();
  if (!current?.refreshToken) throw new Error("Not connected to Spotify");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
  });
  return tokenRequest(body);
}

export async function getValidAccessToken() {
  const current = getStoredTokens();
  if (!current) throw new Error("Not connected to Spotify");
  if (Date.now() < current.expiresAt - 30_000) return current.accessToken;
  const refreshed = await refreshAccessToken();
  return refreshed.accessToken;
}

async function spotifyFetch<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401 && !retried) {
    await refreshAccessToken();
    return spotifyFetch<T>(path, init, true);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error_description || `Spotify API ${res.status}`);
  }
  return data as T;
}

export async function getSpotifyProfile() {
  return spotifyFetch<SpotifyProfile>("/me");
}

export async function getPlaylists(limit = 50) {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(`/me/playlists?limit=${limit}`);
  return data.items ?? [];
}

/** Web Playback SDK needs Widevine EME — missing in Electron / some embedded browsers. */
export async function supportsSpotifyWebPlayback(): Promise<boolean> {
  if (typeof window === "undefined" || !window.isSecureContext) return false;
  if (typeof navigator.requestMediaKeySystemAccess !== "function") return false;
  try {
    await navigator.requestMediaKeySystemAccess("com.widevine.alpha", [
      {
        initDataTypes: ["cenc"],
        audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
      },
    ]);
    return true;
  } catch {
    return false;
  }
}

export type SpotifyDevice = {
  id: string | null;
  is_active: boolean;
  name: string;
  type: string;
};

export async function getDevices() {
  const data = await spotifyFetch<{ devices: SpotifyDevice[] }>("/me/player/devices");
  return data.devices ?? [];
}

export type SpotifyPlaybackState = {
  device?: SpotifyDevice;
  is_playing?: boolean;
  progress_ms?: number;
  shuffle_state?: boolean;
  repeat_state?: "off" | "track" | "context";
  item?: {
    id: string;
    name: string;
    artists: { name: string }[];
    album?: { images?: { url: string }[] };
    uri: string;
    duration_ms: number;
  } | null;
  context?: { uri?: string } | null;
};

export async function getPlaybackState() {
  return spotifyFetch<SpotifyPlaybackState | undefined>("/me/player");
}

export async function transferPlayback(deviceId: string, play = false) {
  await spotifyFetch("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

export async function playUri(options?: {
  deviceId?: string;
  uris?: string[];
  context_uri?: string;
  offset?: { position?: number; uri?: string };
  position_ms?: number;
}) {
  const qs = options?.deviceId ? `?device_id=${encodeURIComponent(options.deviceId)}` : "";
  const body: Record<string, unknown> = {};
  if (options?.uris) body.uris = options.uris;
  if (options?.context_uri) body.context_uri = options.context_uri;
  if (options?.offset) body.offset = options.offset;
  if (options?.position_ms != null) body.position_ms = options.position_ms;
  await spotifyFetch(`/me/player/play${qs}`, {
    method: "PUT",
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  });
}

export async function pausePlayback(deviceId?: string) {
  const qs = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/pause${qs}`, { method: "PUT" });
}

export async function nextTrack(deviceId?: string) {
  const qs = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/next${qs}`, { method: "POST" });
}

export async function previousTrack(deviceId?: string) {
  const qs = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/previous${qs}`, { method: "POST" });
}

export async function setPlayerVolume(volumePercent: number, deviceId?: string) {
  const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
  const params = new URLSearchParams({ volume_percent: String(vol) });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/volume?${params.toString()}`, { method: "PUT" });
}

export async function seekPlayback(positionMs: number, deviceId?: string) {
  const params = new URLSearchParams({ position_ms: String(Math.max(0, Math.round(positionMs))) });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/seek?${params.toString()}`, { method: "PUT" });
}

export type SpotifyPlaylistTrack = {
  id: string;
  name: string;
  artists: string;
  albumArt: string | null;
  uri: string;
  durationMs: number;
};

export async function getPlaylistTracks(playlistId: string, limit = 50): Promise<SpotifyPlaylistTrack[]> {
  // Spotify deprecated /tracks for many apps (403). Use /items; payload field is `item`.
  const data = await spotifyFetch<{
    items: Array<{
      track?: {
        id?: string | null;
        name?: string;
        type?: string;
        artists?: { name: string }[];
        album?: { images?: { url: string }[] };
        uri?: string;
        duration_ms?: number;
      } | null;
      item?: {
        id?: string | null;
        name?: string;
        type?: string;
        artists?: { name: string }[];
        album?: { images?: { url: string }[] };
        uri?: string;
        duration_ms?: number;
      } | null;
    }>;
  }>(`/playlists/${encodeURIComponent(playlistId)}/items?limit=${limit}`);

  return (data.items ?? [])
    .map((row) => row.item ?? row.track ?? null)
    .filter(
      (track): track is NonNullable<typeof track> & { uri: string; name: string } =>
        Boolean(track?.uri && track?.name && track.type !== "episode"),
    )
    .map((track) => {
      const images = track.album?.images ?? [];
      const albumArt = images[0]?.url ?? images[images.length - 1]?.url ?? null;
      return {
        id: track.id || track.uri,
        name: track.name,
        artists: (track.artists || []).map((artist) => artist.name).join(", "),
        albumArt,
        uri: track.uri,
        durationMs: track.duration_ms ?? 0,
      };
    });
}

export async function setShuffle(state: boolean, deviceId?: string) {
  const params = new URLSearchParams({ state: state ? "true" : "false" });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/shuffle?${params.toString()}`, { method: "PUT" });
}

export async function setRepeat(state: "off" | "track" | "context", deviceId?: string) {
  const params = new URLSearchParams({ state });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/repeat?${params.toString()}`, { method: "PUT" });
}
