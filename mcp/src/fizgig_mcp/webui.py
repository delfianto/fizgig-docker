"""ASGI gateway serving the compiled Vue WebUI and proxying authenticated Fizgig APIs."""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import re
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx2 as httpx
import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    Response,
    StreamingResponse,
)
from starlette.routing import Route

TOKEN_META_RE = re.compile(r'name="fizgig-token"\s+content="([^"]+)"')
GPU_PREFIX_RE = re.compile(r"^NVIDIA\s+(?:GeForce\s+)?", re.IGNORECASE)


class TelemetryCollector:
    """Non-blocking cached multi-GPU and host CPU telemetry enricher for /api/stats."""

    def __init__(self) -> None:
        self.gpu_cache: list[dict[str, Any]] = []
        self.last_gpu_time = 0.0
        self.gpu_lock = asyncio.Lock()
        self.prev_cpu_tick: tuple[int, int] | None = None
        self.cpu_cache: dict[str, int | None] = {"util": 0, "temp": None}
        self.last_cpu_time = 0.0
        self.active_cuda_device = 0

    async def get_gpus(self) -> list[dict[str, Any]]:
        now = time.monotonic()
        if now - self.last_gpu_time < 1.2 and self.gpu_cache:
            return self.gpu_cache
        async with self.gpu_lock:
            now = time.monotonic()
            if now - self.last_gpu_time < 1.2 and self.gpu_cache:
                return self.gpu_cache
            try:
                proc = await asyncio.create_subprocess_exec(
                    "nvidia-smi",
                    "--query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,power.limit",
                    "--format=csv,noheader,nounits",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                stdout_bytes, _ = await asyncio.wait_for(
                    proc.communicate(), timeout=1.5
                )
                if proc.returncode == 0:
                    parsed: list[dict[str, Any]] = []
                    for line in (
                        stdout_bytes.decode("utf-8", errors="ignore")
                        .strip()
                        .splitlines()
                    ):
                        parts = [s.strip() for s in line.split(",")]
                        if len(parts) >= 6:
                            parsed.append(
                                {
                                    "index": int(parts[0] or 0),
                                    "name": GPU_PREFIX_RE.sub("", parts[1] or "GPU"),
                                    "vram": [
                                        int(float(parts[3] or 0)) * 1024 * 1024,
                                        int(float(parts[2] or 0)) * 1024 * 1024,
                                    ],
                                    "util": round(float(parts[4] or 0)),
                                    "temp": round(float(parts[5] or 0)),
                                    "power": round(float(parts[6] or 0))
                                    if len(parts) > 6 and parts[6] not in {"", "[N/A]"}
                                    else 0,
                                    "power_limit": round(float(parts[7] or 0))
                                    if len(parts) > 7 and parts[7] not in {"", "[N/A]"}
                                    else 0,
                                }
                            )
                    if parsed:
                        self.gpu_cache = parsed
                        self.last_gpu_time = time.monotonic()
            except (OSError, ValueError, TimeoutError):
                pass
            return self.gpu_cache

    def get_cpu(self) -> dict[str, int | None]:
        now = time.monotonic()
        if now - self.last_cpu_time < 1.2 and self.prev_cpu_tick is not None:
            return self.cpu_cache
        with contextlib.suppress(OSError, ValueError):
            first_line = Path("/proc/stat").read_text(encoding="utf-8").splitlines()[0]
            nums = [int(x) for x in first_line.split()[1:]]
            idle = (nums[3] if len(nums) > 3 else 0) + (nums[4] if len(nums) > 4 else 0)
            total = sum(nums)
            util = self.cpu_cache["util"] or 0
            if self.prev_cpu_tick is not None:
                prev_idle, prev_total = self.prev_cpu_tick
                delta_total = total - prev_total
                delta_idle = idle - prev_idle
                if delta_total > 0:
                    util = max(0, min(100, round(100 * (1 - delta_idle / delta_total))))
            self.prev_cpu_tick = (idle, total)

            temp: int | None = None
            hwmon_root = Path("/sys/class/hwmon")
            if hwmon_root.is_dir():
                for hwmon_dir in hwmon_root.iterdir():
                    name_file = hwmon_dir / "name"
                    if not name_file.is_file():
                        continue
                    chip = name_file.read_text(encoding="utf-8").strip()
                    if chip in {"k10temp", "coretemp"}:
                        for idx in range(1, 9):
                            t_input = hwmon_dir / f"temp{idx}_input"
                            t_label = hwmon_dir / f"temp{idx}_label"
                            if t_input.is_file():
                                label = (
                                    t_label.read_text(encoding="utf-8").strip()
                                    if t_label.is_file()
                                    else f"temp{idx}"
                                )
                                val = round(
                                    int(t_input.read_text(encoding="utf-8").strip())
                                    / 1000
                                )
                                if label in {"Tctl", "Package id 0"} or temp is None:
                                    temp = val
            self.cpu_cache = {"util": util, "temp": temp}
            self.last_cpu_time = now
        return self.cpu_cache


def _forwarded_headers(request: Request) -> dict[str, str]:
    out: dict[str, str] = {}
    for name in ("cookie", "x-fizgig-token", "content-type", "accept", "last-event-id"):
        val = request.headers.get(name)
        if val:
            out[name] = val
    return out


def _append_upstream_cookies(response: Response, upstream: httpx.Response) -> None:
    for cookie in upstream.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", cookie)


def create_webui_app(
    upstream_http: httpx.AsyncClient,
    dist_dir: Path,
    catalog_path: Path,
    telemetry: TelemetryCollector | None = None,
) -> Starlette:
    collector = telemetry or TelemetryCollector()
    resolved_dist = dist_dir.resolve()
    index_file = resolved_dist / "index.html"

    @asynccontextmanager
    async def lifespan(_app: Starlette) -> AsyncIterator[None]:
        async with upstream_http:
            yield

    async def local_bundles(request: Request) -> Response:
        try:
            auth_check = await upstream_http.get(
                "/api/state", headers=_forwarded_headers(request)
            )
        except httpx.HTTPError:
            return JSONResponse(
                {"error": "Upstream Fizgig unavailable"}, status_code=502
            )
        if auth_check.status_code in {401, 403}:
            return JSONResponse(
                {"error": "Authentication required"}, status_code=auth_check.status_code
            )

        if not catalog_path.is_file():
            return JSONResponse(
                {
                    "available": False,
                    "catalogPath": str(catalog_path),
                    "active": [],
                    "bundles": {},
                }
            )
        try:
            raw = json.loads(catalog_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            return JSONResponse(
                {"error": f"Failed to read catalog: {exc}"}, status_code=500
            )

        return JSONResponse(
            {
                "available": True,
                "catalogPath": str(catalog_path),
                "active": raw.get("active")
                if isinstance(raw.get("active"), list)
                else [],
                "bundles": raw.get("bundles")
                if isinstance(raw.get("bundles"), dict)
                else {},
                "externalRoots": (
                    raw.get("external_roots")
                    if isinstance(raw.get("external_roots"), dict)
                    else {}
                ),
            }
        )

    async def proxy_api(request: Request) -> Response:
        subpath = request.path_params.get("rest", "")
        target_path = f"/api/{subpath}"
        if request.url.query:
            target_url = f"{target_path}?{request.url.query}"
        else:
            target_url = target_path

        method = request.method
        body = await request.body() if method not in {"GET", "HEAD"} else b""

        if target_path == "/api/prefs" and method == "POST" and body:
            with contextlib.suppress(ValueError, TypeError, KeyError):
                payload = json.loads(body)
                next_cuda = int(payload["changes"]["cuda_device"])
                if next_cuda >= 0:
                    collector.active_cuda_device = next_cuda

        is_sse_request = (
            target_path == "/api/log"
            or "text/event-stream" in request.headers.get("accept", "")
        )
        if is_sse_request and method == "GET":
            req = upstream_http.build_request(
                "GET", target_url, headers=_forwarded_headers(request)
            )
            try:
                upstream_stream = await upstream_http.send(req, stream=True)
            except httpx.HTTPError:
                return JSONResponse(
                    {"error": "Upstream Fizgig unavailable"}, status_code=502
                )

            if upstream_stream.status_code != 200:
                err_body = await upstream_stream.aread()
                await upstream_stream.aclose()
                resp = Response(
                    content=err_body,
                    status_code=upstream_stream.status_code,
                    media_type=upstream_stream.headers.get(
                        "content-type", "application/json"
                    ),
                )
                _append_upstream_cookies(resp, upstream_stream)
                return resp

            async def event_generator() -> AsyncIterator[bytes]:
                try:
                    async for chunk in upstream_stream.aiter_raw():
                        yield chunk
                finally:
                    await upstream_stream.aclose()

            stream_resp = StreamingResponse(
                event_generator(),
                status_code=200,
                headers={
                    "Content-Type": upstream_stream.headers.get(
                        "content-type", "text/event-stream"
                    ),
                    "Cache-Control": "no-cache, no-transform",
                    "X-Accel-Buffering": "no",
                },
            )
            _append_upstream_cookies(stream_resp, upstream_stream)
            return stream_resp

        try:
            upstream_res = await upstream_http.request(
                method,
                target_url,
                headers=_forwarded_headers(request),
                content=body if body else None,
            )
        except httpx.HTTPError:
            return JSONResponse(
                {"error": "Upstream Fizgig unavailable"}, status_code=502
            )

        content_bytes = upstream_res.content
        res_headers: dict[str, str] = {}
        for h_name in ("content-type", "content-disposition", "cache-control"):
            h_val = upstream_res.headers.get(h_name)
            if h_val:
                res_headers[h_name] = h_val

        if target_path == "/api/prefs" and upstream_res.status_code == 200:
            with contextlib.suppress(ValueError, TypeError, KeyError):
                prefs_data = json.loads(content_bytes)
                saved_cuda = int(prefs_data["cuda_device"])
                if saved_cuda >= 0:
                    collector.active_cuda_device = saved_cuda

        if target_path == "/api/stats" and upstream_res.status_code == 200:
            with contextlib.suppress(ValueError, TypeError):
                stats_data = json.loads(content_bytes)
                if isinstance(stats_data, dict):
                    gpus = await collector.get_gpus()
                    cpu = collector.get_cpu()
                    if gpus:
                        stats_data["gpus"] = gpus
                        selected = next(
                            (
                                g
                                for g in gpus
                                if g["index"] == collector.active_cuda_device
                            ),
                            gpus[0],
                        )
                        stats_data["gpu_util"] = selected["util"]
                        stats_data["gpu_temp"] = selected["temp"]
                        if (
                            not stats_data.get("device_name")
                            or stats_data.get("device_name") == "GPU"
                        ):
                            stats_data["device_name"] = selected["name"]
                    stats_data["cpu"] = cpu
                    stats_data["cpu_util"] = cpu["util"]
                    stats_data["cpu_temp"] = cpu["temp"]
                    content_bytes = json.dumps(stats_data).encode("utf-8")
                    res_headers["content-type"] = "application/json"

        resp = Response(
            content=content_bytes,
            status_code=upstream_res.status_code,
            headers=res_headers,
        )
        _append_upstream_cookies(resp, upstream_res)
        return resp

    async def serve_spa(request: Request) -> Response:
        rel_path = request.url.path.lstrip("/")
        if rel_path:
            candidate = (resolved_dist / rel_path).resolve()
            if (
                candidate.is_relative_to(resolved_dist)
                and candidate != resolved_dist
                and candidate.is_file()
            ):
                cache_header = (
                    "public, max-age=31536000, immutable"
                    if rel_path.startswith("assets/")
                    else "no-cache"
                )
                return FileResponse(candidate, headers={"Cache-Control": cache_header})

        if not index_file.is_file():
            return JSONResponse({"error": "WebUI assets not found"}, status_code=500)

        html = index_file.read_text(encoding="utf-8")
        upstream_root: httpx.Response | None = None
        try:
            upstream_root = await upstream_http.get(
                "/",
                headers={
                    "Accept": "text/html",
                    **(
                        {"Cookie": request.headers["cookie"]}
                        if "cookie" in request.headers
                        else {}
                    ),
                },
            )
            match = TOKEN_META_RE.search(upstream_root.text)
            if match:
                token = match.group(1)
                meta_tag = f'<meta name="fizgig-token" content="{token}" />'
                if "</head>" in html:
                    html = html.replace("</head>", f"  {meta_tag}\n  </head>", 1)
                else:
                    html = meta_tag + html
        except httpx.HTTPError:
            pass

        resp = HTMLResponse(html, headers={"Cache-Control": "no-cache"})
        if upstream_root is not None:
            _append_upstream_cookies(resp, upstream_root)
        return resp

    return Starlette(
        lifespan=lifespan,
        routes=[
            Route("/ui-api/local/bundles", local_bundles, methods=["GET"]),
            Route(
                "/api/{rest:path}",
                proxy_api,
                methods=["GET", "POST", "PUT", "DELETE", "HEAD"],
            ),
            Route("/{rest:path}", serve_spa, methods=["GET", "HEAD"]),
        ],
    )


def main() -> None:
    upstream_url = os.environ.get("FIZGIG_UPSTREAM_URL", "http://127.0.0.1:18081")
    if urlsplit(upstream_url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Upstream Fizgig server must use container loopback")

    dist_dir = Path(os.environ.get("FIZGIG_WEBUI_DIST", "/opt/fizgig-webui"))
    catalog_path = Path(
        os.environ.get("FIZGIG_MODEL_CATALOG", "/etc/fizgig/models.json")
    )

    upstream_http = httpx.AsyncClient(
        base_url=upstream_url,
        timeout=httpx.Timeout(60.0, connect=10.0),
        trust_env=False,
    )
    app = create_webui_app(upstream_http, dist_dir, catalog_path)
    uvicorn.run(
        app,
        host=os.environ.get("FIZGIG_WEBUI_HOST", "0.0.0.0"),
        port=int(os.environ.get("FIZGIG_WEBUI_PORT", "8081")),
        access_log=False,
    )


if __name__ == "__main__":
    main()
