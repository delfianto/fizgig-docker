import { existsSync, readFileSync } from "node:fs";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { type Plugin } from "vite-plus";

interface ProxyOptions {
  apiUrl?: string;
  passwordFile?: string;
  catalogFile?: string;
}

function resolvePassword(passwordFile: string): string {
  if (process.env.FIZGIG_PASSWORD) {
    return process.env.FIZGIG_PASSWORD.trim();
  }
  const candidates = [
    passwordFile,
    process.env.FIZGIG_AUTH_FILE ?? "",
    "/srv/appdata/secret/fizgig_password",
    "/run/secrets/FIZGIG_PASSWORD",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8").trim();
    }
  }
  return "";
}

function resolveCatalogPath(catalogFile: string): string {
  const candidates = [
    catalogFile,
    process.env.FIZGIG_MODEL_CATALOG ?? "",
    "/srv/appdata/fizgig/config/models.json",
    "/etc/fizgig/models.json",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function fizgigProxyPlugin(options: ProxyOptions = {}): Plugin {
  const baseUrl = (options.apiUrl ?? process.env.FIZGIG_API_URL ?? "http://127.0.0.1:8082").replace(
    /\/+$/,
    "",
  );

  const password = resolvePassword(options.passwordFile ?? "");
  const catalogPath = resolveCatalogPath(options.catalogFile ?? "");

  let sessionToken = "";
  let sessionCookie = "";
  let loginPromise: Promise<void> | null = null;

  async function ensureAuthenticated(force = false): Promise<void> {
    if (sessionToken && !force) return;
    if (loginPromise) return loginPromise;

    loginPromise = (async () => {
      try {
        const pageRes = await fetch(`${baseUrl}/`, {
          headers: { Accept: "text/html" },
        });
        if (!pageRes.ok) {
          throw new Error(`Upstream root returned HTTP ${pageRes.status}`);
        }
        const html = await pageRes.text();
        const match = html.match(/name="fizgig-token"\s+content="([^"]+)"/);
        if (!match?.[1]) {
          throw new Error("Upstream HTML does not contain fizgig-token meta tag");
        }
        sessionToken = match[1];

        if (password) {
          const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Fizgig-Token": sessionToken,
            },
            body: JSON.stringify({ password }),
          });
          if (!loginRes.ok) {
            throw new Error(`Fizgig /api/login failed with HTTP ${loginRes.status}`);
          }
          const setCookie = loginRes.headers.get("set-cookie");
          if (setCookie) {
            sessionCookie = setCookie.split(";")[0] ?? "";
          }
        }
      } finally {
        loginPromise = null;
      }
    })();

    return loginPromise;
  }

  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    const url = req.url ?? "/";

    // Local manifest catalog inspection endpoint
    if (url === "/ui-api/local/bundles" && req.method === "GET") {
      try {
        if (!catalogPath || !existsSync(catalogPath)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              available: false,
              catalogPath: catalogPath || null,
              active: [],
              bundles: {},
            }),
          );
          return;
        }
        const raw = JSON.parse(readFileSync(catalogPath, "utf8")) as Record<string, unknown>;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            available: true,
            catalogPath,
            active: Array.isArray(raw.active) ? raw.active : [],
            bundles: typeof raw.bundles === "object" && raw.bundles !== null ? raw.bundles : {},
            externalRoots:
              typeof raw.external_roots === "object" && raw.external_roots !== null
                ? raw.external_roots
                : {},
          }),
        );
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : "Failed to read catalog",
          }),
        );
      }
      return;
    }

    if (!url.startsWith("/api/")) {
      next();
      return;
    }

    try {
      await ensureAuthenticated(false);
      const method = req.method ?? "GET";
      const bodyBuf = method !== "GET" && method !== "HEAD" ? await readRequestBody(req) : null;

      for (let attempt = 0; attempt < 2; attempt++) {
        const headers: Record<string, string> = {
          "X-Fizgig-Token": sessionToken,
        };
        if (sessionCookie) {
          headers.Cookie = sessionCookie;
        }
        const contentType = req.headers["content-type"];
        if (typeof contentType === "string") {
          headers["Content-Type"] = contentType;
        }

        const upstreamRes = await fetch(`${baseUrl}${url}`, {
          method,
          headers,
          body: bodyBuf && bodyBuf.length > 0 ? new Uint8Array(bodyBuf) : undefined,
        });

        if ((upstreamRes.status === 401 || upstreamRes.status === 403) && attempt === 0) {
          await ensureAuthenticated(true);
          continue;
        }

        const resHeaders: Record<string, string> = {};
        const upstreamCt = upstreamRes.headers.get("content-type");
        if (upstreamCt) resHeaders["Content-Type"] = upstreamCt;
        const upstreamCd = upstreamRes.headers.get("content-disposition");
        if (upstreamCd) resHeaders["Content-Disposition"] = upstreamCd;
        const upstreamCc = upstreamRes.headers.get("cache-control");
        if (upstreamCc) resHeaders["Cache-Control"] = upstreamCc;

        const arrayBuf = await upstreamRes.arrayBuffer();
        res.writeHead(upstreamRes.status, resHeaders);
        res.end(Buffer.from(arrayBuf));
        return;
      }
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            err instanceof Error
              ? `Upstream Fizgig unreachable (${baseUrl}): ${err.message}`
              : "Upstream Fizgig request failed",
        }),
      );
    }
  }

  return {
    name: "fizgig-authenticated-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleRequest(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleRequest(req, res, next);
      });
    },
  };
}
