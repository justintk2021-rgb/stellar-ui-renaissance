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

function redirectUri() {
  return `${window.location.origin}/spotify-callback`;
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

export async function beginSpotifyLogin() {
  if (!CLIENT_ID?.trim()) {
    throw new Error("Missing VITE_SPOTIFY_CLIENT_ID");
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
