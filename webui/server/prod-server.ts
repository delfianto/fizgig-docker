import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createFizgigRequestHandler } from "./fizgig-proxy";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(rootDir, "dist");
const indexHtmlPath = resolve(distDir, "index.html");

const host = process.env.FIZGIG_WEBUI_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.FIZGIG_WEBUI_PORT ?? "8084", 10);

const proxyHandler = createFizgigRequestHandler();

const server = createServer((req, res) => {
  void proxyHandler(req, res, () => {
    const rawUrl = req.url ?? "/";
    let pathname = "/";
    try {
      pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
    } catch {
      pathname = "/";
    }

    const candidate = resolve(distDir, `.${pathname}`);
    const isInsideDist = candidate === distDir || candidate.startsWith(`${distDir}${sep}`);

    if (isInsideDist && existsSync(candidate) && statSync(candidate).isFile()) {
      const ext = extname(candidate).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const cacheControl = pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      });
      createReadStream(candidate).pipe(res);
      return;
    }

    if (existsSync(indexHtmlPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      createReadStream(indexHtmlPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Production bundle not built yet. Run `bun run build` first.",
      }),
    );
  });
});

server.listen(port, host, () => {
  console.info(`Fizgig WebUI server listening on http://${host}:${port}`);
});
