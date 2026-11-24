// CI rehearsal stand-ins: the bay camera server (HLS files on :5080) and the Bike Surgeon Inventory feed (:3021).
import { appendFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const CAM_DIR = process.env.CAM_DIR ?? "/srv/cam";
const FEED_KEY = process.env.FEED_KEY ?? "";
const PORTALS = ["cashier", "counter", "desk", "motolab", "supervisor", "spares", "admin", "accounts", "billing"];
const note = (line) => appendFileSync("/tmp/fake-inventory.log", `${line}\n`);

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(CAM_DIR, path);
  if (!file.startsWith(CAM_DIR) || !existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": extname(file) === ".m3u8" ? "application/vnd.apple.mpegurl" : "video/mp2t" });
  createReadStream(file).pipe(res);
}).listen(5080, "127.0.0.1");

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
  note(`${req.method} ${url.pathname} key=${req.headers["x-feed-key"] === FEED_KEY ? "right" : "WRONG"} portal=${req.headers["x-portal"]}`);
  if (req.headers["x-feed-key"] !== FEED_KEY) return send(401, { error: "Wrong or missing feed key." });
  if (!PORTALS.includes(String(req.headers["x-portal"]))) return send(400, { error: "X-Portal" });
  if (req.method === "GET" && url.pathname === "/api/feed/parts") {
    const since = Number(url.searchParams.get("since")) || 0;
    const parts = since < 1000
      ? [{ id: 11, pno: "RE-AF-350", name: "Air filter", brand: "Royal Enfield", model: "Classic 350", hsn: "8421", gst: 18, mrp: 450, dUser: 0, stock: 6, rack: "A1", active: true, upd: 1000 }]
      : [];
    return send(200, { parts, next: parts.length ? 1000 : since, more: false });
  }
  if (req.method === "POST" && url.pathname === "/api/import/sales") return send(200, { ok: true });
  send(404, { error: "not found" });
}).listen(3021, "127.0.0.1");
console.log("fake camera :5080 and Inventory :3021 ready");
