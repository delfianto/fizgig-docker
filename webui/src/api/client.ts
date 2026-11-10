export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const baseOrigin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1";
  const url = new URL(path, baseOrigin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof data.error === "string") {
    throw new ApiError(
      typeof data.error === "string" ? data.error : `HTTP ${response.status} on ${path}`,
      response.status,
    );
  }
  return data as T;
}

export async function apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof data.error === "string") {
    throw new ApiError(
      typeof data.error === "string" ? data.error : `HTTP ${response.status} on ${path}`,
      response.status,
    );
  }
  return data as T;
}

export function thumbUrl(filePath: string, size = 320): string {
  const params = new URLSearchParams({ path: filePath, size: String(size) });
  return `/api/thumb?${params.toString()}`;
}

export function mediaUrl(filePath: string): string {
  const params = new URLSearchParams({ path: filePath });
  return `/api/media?${params.toString()}`;
}

export function downloadUrl(filePath: string): string {
  const params = new URLSearchParams({ path: filePath });
  return `/api/download?${params.toString()}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx >= 3 ? 1 : 0)} ${units[idx]}`;
}
