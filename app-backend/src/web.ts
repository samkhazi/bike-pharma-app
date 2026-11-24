import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "./auth.js";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".txt": "text/plain; charset=utf-8",
  ".apk": "application/vnd.android.package-archive",
};

/** Paths of the API itself: never answered with the web app. */
const API_PATH = /^\/(v1|integration)(\/|$)|^\/(docs|openapi\.json|health)(\/|$)/;

/**
 * Serves the built web app (app-frontend/dist) from the same address as the API, so testers can open the app in a
 * phone browser and the Android app can be downloaded from /download/. Any path without a file extension that is
 * not a file is a screen of the app and gets index.html.
 */
export function serveWebApp(app: OpenAPIHono<AppEnv>, dir: string) {
  const root = resolve(dir);
  app.get("*", async (c, next) => {
    const path = c.req.path;
    if (API_PATH.test(path)) return next();
    let rel: string;
    try {
      rel = decodeURIComponent(path);
    } catch {
      return next();
    }
    let file = resolve(root, `.${rel}`);
    if (file !== root && !file.startsWith(root + sep)) return next();
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      if (extname(rel)) return next(); // a missing file stays a 404
      file = join(root, "index.html");
      info = await stat(file).catch(() => null);
      if (!info?.isFile()) return next();
    }
    const body = new Uint8Array(await readFile(file));
    const hashed = file.startsWith(join(root, "assets") + sep);
    const headers: Record<string, string> = {
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
    };
    if (extname(file).toLowerCase() === ".apk") headers["content-disposition"] = 'attachment; filename="bike-surgeon.apk"';
    return c.body(body, 200, headers);
  });
}
