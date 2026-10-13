// Minimal static server for local preview: node scripts/serve.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const dist = path.resolve(import.meta.dirname, "../dist");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };
export function serve(port = 4173) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = path.join(dist, decodeURIComponent(url.pathname));
    if (!p.startsWith(dist)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.writeHead(404, { "content-type": types[".html"] }).end(fs.readFileSync(path.join(dist, "404.html"))); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream", "cache-control": "no-cache" }).end(fs.readFileSync(p));
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
if (process.argv[1] === import.meta.filename) { const port = Number(process.argv[2]) || 4173; await serve(port); console.log(`http://localhost:${port}`); }
