import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
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

// ---------------------------------------------------------------------------
// Hardware Telemetry Collectors (GPU & CPU Load, Temp, Multi-GPU)
// ---------------------------------------------------------------------------

let cachedGpuStats: Array<{
  index: number;
  name: string;
  vram: [number, number];
  util: number;
  temp: number;
  power?: number;
  power_limit?: number;
}> = [];
let lastGpuSampleTime = 0;

function getCachedGpuStats() {
  const now = Date.now();
  if (now - lastGpuSampleTime < 1200 && cachedGpuStats.length > 0) {
    return cachedGpuStats;
  }
  try {
    const raw = execSync(
      "nvidia-smi --query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits",
      { encoding: "utf8", timeout: 1500 },
    );
    const list: typeof cachedGpuStats = [];
    for (const line of raw.trim().split("\n")) {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length >= 6) {
        list.push({
          index: parseInt(parts[0] ?? "0", 10),
          name: (parts[1] ?? "GPU").replace(/^NVIDIA GeForce\s+/, ""),
          vram: [
            parseInt(parts[3] ?? "0", 10) * 1024 * 1024,
            parseInt(parts[2] ?? "0", 10) * 1024 * 1024,
          ],
          util: Math.round(parseFloat(parts[4] ?? "0") || 0),
          temp: Math.round(parseFloat(parts[5] ?? "0") || 0),
          power: Math.round(parseFloat(parts[6] ?? "0") || 0),
          power_limit: Math.round(parseFloat(parts[7] ?? "0") || 0),
        });
      }
    }
    if (list.length > 0) {
      cachedGpuStats = list;
      lastGpuSampleTime = now;
    }
  } catch {
    // Keep previous cached values if query hiccups
  }
  return cachedGpuStats;
}

let prevCpuTick: { idle: number; total: number } | null = null;
let cachedCpuStats = { util: 0, temp: null as number | null };
let lastCpuSampleTime = 0;

function getCachedCpuStats() {
  const now = Date.now();
  if (now - lastCpuSampleTime < 1200 && prevCpuTick !== null) {
    return cachedCpuStats;
  }
  try {
    const stat = readFileSync("/proc/stat", "utf8").split("\n")[0] ?? "";
    const parts = stat
      .replace(/^cpu\s+/, "")
      .split(/\s+/)
      .map(Number);
    const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
    const total = parts.reduce((a, b) => a + b, 0);

    let util = cachedCpuStats.util;
    if (prevCpuTick) {
      const deltaTotal = total - prevCpuTick.total;
      const deltaIdle = idle - prevCpuTick.idle;
      if (deltaTotal > 0) {
        util = Math.max(0, Math.min(100, Math.round(100 * (1 - deltaIdle / deltaTotal))));
      }
    }
    prevCpuTick = { idle, total };

    let temp: number | null = null;
    if (existsSync("/sys/class/hwmon")) {
      const dirs = readdirSync("/sys/class/hwmon");
      for (const dir of dirs) {
        const namePath = `/sys/class/hwmon/${dir}/name`;
        if (existsSync(namePath)) {
          const name = readFileSync(namePath, "utf8").trim();
          if (name === "k10temp" || name === "coretemp") {
            for (let i = 1; i <= 8; i++) {
              const tPath = `/sys/class/hwmon/${dir}/temp${i}_input`;
              const lPath = `/sys/class/hwmon/${dir}/temp${i}_label`;
              if (existsSync(tPath)) {
                const label = existsSync(lPath) ? readFileSync(lPath, "utf8").trim() : `temp${i}`;
                const val = parseInt(readFileSync(tPath, "utf8").trim(), 10) / 1000;
                if (label === "Tctl" || label === "Package id 0" || !temp) {
                  temp = Math.round(val);
                }
              }
            }
          }
        }
      }
    }
    cachedCpuStats = { util, temp };
    lastCpuSampleTime = now;
  } catch {
    // Ignore read errors
  }
  return cachedCpuStats;
}

// ---------------------------------------------------------------------------
// Proxy Plugin
// ---------------------------------------------------------------------------

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
        const accept = req.headers.accept;
        if (typeof accept === "string") {
          headers.Accept = accept;
        }
        const lastEventId = req.headers["last-event-id"];
        if (typeof lastEventId === "string") {
          headers["Last-Event-ID"] = lastEventId;
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

        // Stream SSE or real-time event streams without buffering the entire body
        const isEventStream =
          upstreamCt?.includes("text/event-stream") ||
          (url.startsWith("/api/log") && upstreamRes.status === 200);

        if (isEventStream && upstreamRes.body) {
          resHeaders["Content-Type"] = upstreamCt || "text/event-stream";
          resHeaders["Cache-Control"] = "no-cache, no-transform";
          resHeaders["Connection"] = "keep-alive";
          resHeaders["X-Accel-Buffering"] = "no";
          res.writeHead(upstreamRes.status, resHeaders);
          if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
          }

          const nodeStream = Readable.fromWeb(
            upstreamRes.body as Parameters<typeof Readable.fromWeb>[0],
          );
          nodeStream.pipe(res);

          const cleanup = () => {
            try {
              nodeStream.destroy();
            } catch {
              // ignore
            }
          };

          req.on("close", cleanup);
          req.on("error", cleanup);
          nodeStream.on("error", () => {
            try {
              res.destroy();
            } catch {
              // ignore
            }
          });
          return;
        }

        const arrayBuf = await upstreamRes.arrayBuffer();

        // Enrich /api/stats with multi-GPU and CPU load/temperature telemetry
        if (url === "/api/stats" && upstreamRes.status === 200) {
          try {
            const rawText = new TextDecoder().decode(arrayBuf);
            const data = JSON.parse(rawText) as Record<string, unknown>;
            const gpus = getCachedGpuStats();
            const cpu = getCachedCpuStats();

            if (gpus.length > 0) {
              data.gpus = gpus;
              const primary = gpus[0];
              if (primary) {
                data.gpu_util = primary.util;
                data.gpu_temp = primary.temp;
                if (!data.device_name || data.device_name === "GPU") {
                  data.device_name = primary.name;
                }
              }
            }

            data.cpu = cpu;
            data.cpu_util = cpu.util;
            data.cpu_temp = cpu.temp;

            const enrichedBuf = Buffer.from(JSON.stringify(data));
            resHeaders["Content-Type"] = "application/json";
            res.writeHead(200, resHeaders);
            res.end(enrichedBuf);
            return;
          } catch {
            // fallback to original buffer on parse error
          }
        }

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
