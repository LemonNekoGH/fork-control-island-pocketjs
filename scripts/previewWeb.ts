import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

const siteRoot = resolve(import.meta.dir, "../site");
const entry = resolve(siteRoot, "index.html");
if (!existsSync(entry)) throw new Error("Missing site/index.html; run `bun run build:web` first");

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".pak": "application/octet-stream",
};

const hostname = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT must be an integer from 1 through 65535, got ${process.env.PORT}`);
}

const server = Bun.serve({
  hostname,
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const filePath = resolve(siteRoot, relativePath);
    if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}/`)) {
      return new Response("not found", { status: 404 });
    }

    const file = Bun.file(filePath);
    if (!await file.exists()) return new Response("not found", { status: 404 });
    return new Response(file, {
      headers: {
        "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  },
});

console.log(`GitHub Pages preview: ${server.url}`);
