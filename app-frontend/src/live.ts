import { store } from "./native";

/**
 * The connection to the Bike Surgeon API. When VITE_API_URL is set the app runs on real data
 * (the workshop's job cards, bills, bays and cameras); when it is empty the app keeps its built-in sample data.
 */
const base = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
export const live = base !== "";

/** hls.js for Android's WebView (Safari and iOS play HLS natively). Loaded only when a camera is opened. */
const HLS_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.mjs";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Tokens = { accessToken: string; refreshToken: string };

let access = store.get("api.access") ?? "";
let refresh = store.get("api.refresh") ?? "";
let refreshing: Promise<boolean> | null = null;
const signedOutListeners = new Set<() => void>();

export function hasSession() {
  return Boolean(refresh);
}

export function saveSession(tokens: Tokens) {
  access = tokens.accessToken;
  refresh = tokens.refreshToken;
  store.set("api.access", access);
  store.set("api.refresh", refresh);
}

export function clearSession() {
  access = "";
  refresh = "";
  store.set("api.access", "");
  store.set("api.refresh", "");
}

export function onSignedOut(listener: () => void) {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

async function renew() {
  if (!refresh) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${base}/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          clearSession();
          signedOutListeners.forEach((listener) => listener());
        }
        return false;
      }
      saveSession((await response.json()) as Tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const hasBody = init.body !== undefined;
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: init.method ?? (hasBody ? "POST" : "GET"),
      headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...(access ? { authorization: `Bearer ${access}` } : {}) },
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline", "No internet connection. Try again.");
  }
  if (response.status === 401 && retry && refresh && (await renew())) return api<T>(path, init, false);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? "error", error?.message ?? "Something went wrong. Try again.");
  }
  return data as T;
}

/** Plays a camera link in a <video>. Returns a function that stops it. */
export async function playStream(video: HTMLVideoElement, url: string, onError: () => void): Promise<() => void> {
  const hlsLink = /\.m3u8(\?|$)/i.test(url);
  if (!hlsLink || video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    video.onerror = onError;
    video.play().catch(() => {});
    return () => {
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
    };
  }
  type HlsInstance = { loadSource(url: string): void; attachMedia(video: HTMLVideoElement): void; on(event: string, fn: (event: string, data: { fatal?: boolean }) => void): void; destroy(): void };
  type HlsClass = { new (config?: object): HlsInstance; isSupported(): boolean; Events: { MANIFEST_PARSED: string; ERROR: string } };
  const Hls = ((await import(/* @vite-ignore */ HLS_URL)) as { default: HlsClass }).default;
  if (!Hls.isSupported()) {
    video.src = url;
    return () => video.removeAttribute("src");
  }
  const hls = new Hls({ liveDurationInfinity: true });
  hls.loadSource(url);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(() => {});
  });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data?.fatal) onError();
  });
  return () => hls.destroy();
}

/** Ends the session on the server and on this phone. */
export async function logout() {
  const token = refresh;
  clearSession();
  if (!token) return;
  await fetch(`${base}/v1/auth/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: token }) }).catch(() => {});
}
