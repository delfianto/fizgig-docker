"""Bounded named operations. The UI owns the queue, runs and training processes."""

from __future__ import annotations

import asyncio
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import httpx2 as httpx
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

MAX_BYTES = 8 * 1024 * 1024
Json = dict[str, Any]


def redact(value: Any, secret: str = "") -> Any:
    if isinstance(value, dict):
        return {
            k: "[redacted]"
            if re.search(
                r"(?:^|_)(?:password|token|secret|api_key|authorization)$",
                k,
                re.IGNORECASE,
            )
            else redact(v, secret)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact(v, secret) for v in value]
    if isinstance(value, str) and secret:
        return value.replace(secret, "[redacted]")
    return value


def child(root: Path, name: str) -> Path:
    path = (root / name).resolve()
    if (
        Path(name).is_absolute()
        or not path.is_relative_to(root.resolve())
        or path == root.resolve()
    ):
        raise ToolError("Choose a path below the configured data root")
    return path


class FizgigAPI:
    def __init__(self, http: httpx.AsyncClient, password: str) -> None:
        self.http = http
        self.password = password
        self.token = ""
        self.auth_lock = asyncio.Lock()
        self.mutation_lock = asyncio.Lock()

    async def login(self) -> None:
        async with self.auth_lock:
            try:
                response = await self.http.get("/")
                response.raise_for_status()
                found = re.search(
                    r'name="fizgig-token" content="([^"]+)"', response.text
                )
                if found is None:
                    raise ToolError("Fizgig login page is incompatible")
                self.token = found.group(1)
                response = await self.http.post(
                    "/api/login",
                    json={"password": self.password},
                    headers={"X-Fizgig-Token": self.token},
                )
                if response.status_code != 200:
                    raise ToolError("Fizgig login failed")
            except httpx.HTTPError:
                raise ToolError("Fizgig UI is unavailable; check its health") from None

    async def request(self, route: str, body: Json | None = None, **params: Any) -> Any:
        if not self.token:
            await self.login()
        # Only named adapter methods supply routes; there is no raw-request tool.
        for attempt in range(2):
            try:
                async with self.http.stream(
                    "GET" if body is None else "POST",
                    "/api/" + route,
                    params=params,
                    json=body,
                    headers={"X-Fizgig-Token": self.token},
                ) as response:
                    if response.status_code in (401, 403) and attempt == 0:
                        await self.login()
                        continue
                    if response.status_code != 200:
                        raise ToolError(
                            f"Fizgig API {route} returned HTTP {response.status_code}"
                        )
                    content = bytearray()
                    async for chunk in response.aiter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_BYTES:
                            raise ToolError("Fizgig response exceeds 8 MiB")
                    data = redact(json.loads(content), self.password)
            except httpx.HTTPError:
                raise ToolError(
                    "Fizgig request failed or timed out; mutation outcome may be uncertain. Read status before retrying."
                ) from None
            except (ValueError, UnicodeError):
                raise ToolError("Fizgig returned invalid JSON") from None
            if isinstance(data, dict) and data.get("error"):
                raise ToolError(str(data["error"]))
            return data
        raise ToolError("Fizgig authentication failed")

    async def plan(self, family: str, values: Json, image_folder: str) -> Any:
        datasets = Path(os.environ.get("FIZGIG_DATASETS_ROOT", "/datasets")).resolve()
        folder = Path(image_folder).resolve()
        if (
            not folder.is_relative_to(datasets)
            or folder == datasets
            or not folder.is_dir()
        ):
            raise ToolError(
                "Training images must be an existing folder below /datasets"
            )
        if not values.get("LORA_NAME") or not re.fullmatch(
            r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", str(values["LORA_NAME"])
        ):
            raise ToolError(
                "Supply a LoRA name starting with a letter/digit and containing only letters, digits, _, . or -"
            )
        out = Path(
            str(values.get("LORA_OUTPUT_DIR") or "/workspace/output_loras")
        ).resolve()
        output_root = Path(
            os.environ.get("FIZGIG_OUTPUT_ROOT", "/workspace/output_loras")
        ).resolve()
        if not out.is_relative_to(output_root):
            raise ToolError("Training outputs must stay within the Fizgig output root")
        if any(str(k).startswith("__") for k in values):
            raise ToolError("Internal run-control fields cannot be supplied")
        if self.password in json.dumps(values):
            raise ToolError("Configuration must not contain credentials")
        schema = await self.request("schema")
        desc = next((f for f in schema["families"] if f["key"] == family), None)
        if desc is None:
            raise ToolError("Unknown Fizgig family; read get_family first")
        allowed = {
            r["key"]
            for s in desc["form"]["sections"]
            for r in s["rows"]
            if r and "key" in r
        }
        if set(values) - allowed:
            raise ToolError(
                "Configuration contains fields outside the selected family's form"
            )
        result = await self.request(
            "plan", {"family": family, "values": values, "image_folder": str(folder)}
        )
        return {
            **result,
            "family": family,
            "values": values,
            "image_folder": str(folder),
            "submitted": False,
        }


def create_server(api: FizgigAPI) -> MCPServer:
    server = MCPServer("Fizgig")
    read = ToolAnnotations(
        read_only_hint=True, destructive_hint=False, open_world_hint=False
    )
    write = ToolAnnotations(
        read_only_hint=False, destructive_hint=False, open_world_hint=False
    )

    @server.tool(annotations=read)
    async def get_status() -> Json:
        """Read live run and queue state. Does not start work or reserve a GPU."""
        return await api.request("run")

    @server.tool(annotations=read)
    async def get_gpu_stats() -> Json:
        """Read GPU and system memory telemetry; does not allocate model memory."""
        return await api.request("stats")

    @server.tool(annotations=read)
    async def list_runs(limit: int = 50) -> Json:
        """List existing run history; IDs are Fizgig IDs, never AI Toolkit job IDs."""
        if not 1 <= limit <= 200:
            raise ToolError("limit must be 1..200")
        data = await api.request("runs")
        return {"runs": data["runs"][:limit]}

    @server.tool(annotations=read)
    async def get_run(run_id: str) -> Json:
        """Read a returned historical run ID with its family and saved form values."""
        data = await api.request("runs")
        match = next((r for r in data["runs"] if r["id"] == run_id), None)
        if match is None:
            raise ToolError("Run not found")
        return match

    @server.tool(annotations=read)
    async def get_run_loss(run_id: str) -> Json:
        """Read saved per-step loss for a historical run. Never resumes training."""
        await get_run(run_id)
        return await api.request("runs/loss", id=run_id)

    async def output_folder(run_id: str) -> tuple[Path, Json]:
        run = await get_run(run_id)
        root = Path(
            os.environ.get("FIZGIG_OUTPUT_ROOT", "/workspace/output_loras")
        ).resolve()
        folder = Path(run.get("output_dir") or "").resolve()
        if not folder.is_relative_to(root):
            raise ToolError("Run output is outside the configured Fizgig output root")
        return folder, run

    @server.tool(annotations=read)
    async def get_run_files(run_id: str) -> Json:
        """List saved checkpoint paths for one historical run. Never downloads/imports weights."""
        folder, run = await output_folder(run_id)
        data = await api.request("checkpoints", dir=str(folder))
        name = str(run.get("lora") or "")
        return {
            "run_id": run_id,
            "lora": name,
            "directory": str(folder),
            "files": [
                item for item in data.get("items", []) if item.get("run") == name
            ],
        }

    @server.tool(annotations=read)
    async def get_run_samples(run_id: str) -> Json:
        """List existing preview media for a historical run; does not render anything."""
        folder, run = await output_folder(run_id)
        return await api.request(
            "samples", dir=str(folder / "sample"), run=str(run.get("lora") or "")
        )

    @server.tool(annotations=read)
    async def list_queue() -> Json:
        """Read pending jobs and whether the shared queue is held."""
        return (await api.request("run"))["web_queue"]

    @server.tool(annotations=read)
    async def get_queue_item(item_id: str) -> Json:
        """Read full family/form values of one returned queue ID."""
        return await api.request("queue/item", id=item_id)

    @server.tool(annotations=read)
    async def list_families() -> Json:
        """List supported training families. Use get_family for form fields and presets."""
        data = await api.request("schema")
        return {
            "families": [
                {k: f.get(k) for k in ("key", "display_name", "media", "experimental")}
                for f in data["families"]
            ]
        }

    @server.tool(annotations=read)
    async def get_family(family: str) -> Json:
        """Read the complete upstream form, presets and model requirements for one family."""
        data = await api.request("schema")
        for desc in data["families"]:
            if desc["key"] == family:
                return desc
        raise ToolError("Unknown family")

    @server.tool(annotations=read)
    async def list_model_bundles() -> Json:
        """Read explicit local manifest bundles; no downloads or preference changes."""
        from fizgig_local.catalog import Catalog

        catalog = Catalog(
            Path(os.environ.get("FIZGIG_MODEL_CATALOG", "/etc/fizgig/models.json"))
        )
        return {"active": catalog.config.get("active", []), "bundles": catalog.bundles}

    @server.tool(annotations=read)
    async def validate_model_bundle(bundle_id: str) -> Json:
        """Preflight an existing bundle's files, sizes and headers without loading tensors."""
        from fizgig_local.catalog import Catalog

        catalog = Catalog(
            Path(os.environ.get("FIZGIG_MODEL_CATALOG", "/etc/fizgig/models.json"))
        )
        return {
            "bundle_id": bundle_id,
            "preferences": catalog.resolve_bundle(bundle_id),
        }

    @server.tool(annotations=read)
    async def get_paths() -> Json:
        """Read container data paths and model paths; never returns raw credentials/settings."""
        data = await api.request("prefs")
        return {
            "datasets": "/datasets",
            "output": data.get("output_default"),
            "models": data.get("models"),
            "cache": data.get("cache_dir"),
            "cuda_device": data.get("cuda_device"),
        }

    @server.tool(annotations=read)
    async def list_datasets() -> Json:
        """Read training folders tracked by the existing Fizgig UI."""
        return await api.request("datasets")

    def dataset_image(dataset: str, image: str) -> Path:
        root = Path(os.environ.get("FIZGIG_DATASETS_ROOT", "/datasets"))
        folder = child(root, dataset)
        path = child(folder, image)
        if not path.is_file() or path.suffix.lower() not in {
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
        }:
            raise ToolError(
                "Choose an existing training image below its dataset folder"
            )
        return path

    @server.tool(annotations=read)
    async def get_dataset_info(dataset: str) -> Json:
        """Inspect a dataset path relative to /datasets. Returns bounded image names and caption coverage."""
        root = Path(os.environ.get("FIZGIG_DATASETS_ROOT", "/datasets"))
        folder = child(root, dataset)
        if not folder.is_dir():
            raise ToolError("Dataset directory does not exist")
        images = []
        for path in folder.iterdir():
            if (
                path.is_file()
                and not path.is_symlink()
                and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
            ):
                images.append(path.name)
                if len(images) > 10000:
                    raise ToolError("Dataset exceeds the 10000 image inspection limit")
        images.sort()
        return {
            "dataset": dataset,
            "path": str(folder),
            "images": images,
            "captioned": sum(
                (folder / p).with_suffix(".txt").is_file() for p in images
            ),
        }

    @server.tool(annotations=read)
    async def get_caption(dataset: str, image: str) -> Json:
        """Read a paired UTF-8 TXT caption; paths are relative to /datasets and the chosen dataset."""
        path = dataset_image(dataset, image).with_suffix(".txt")
        folder = child(
            Path(os.environ.get("FIZGIG_DATASETS_ROOT", "/datasets")), dataset
        )
        path = child(folder, str(path.relative_to(folder)))
        if not path.exists():
            return {"caption": "", "exists": False}
        if path.stat().st_size > 65536:
            raise ToolError("Caption exceeds 64 KiB")
        return redact({"caption": path.read_text(), "exists": True}, api.password)

    @server.tool(annotations=write)
    async def set_caption(dataset: str, image: str, caption: str) -> Json:
        """Overwrite one paired TXT caption atomically. Changes shared Toolkit/Fizgig dataset data; never starts work."""
        if len(caption.encode()) > 65536:
            raise ToolError("Caption exceeds 64 KiB")
        path = dataset_image(dataset, image).with_suffix(".txt")
        if path.is_symlink():
            raise ToolError("Caption symlinks are not writable")
        fd, temp = tempfile.mkstemp(prefix=".caption-", dir=path.parent)
        try:
            with os.fdopen(fd, "w") as stream:
                stream.write(caption)
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
        return {"ok": True, "dataset": dataset, "image": image}

    @server.tool(annotations=read)
    async def list_outputs() -> Json:
        """Read existing trained outputs; does not render previews or download weights."""
        return await api.request("outputs")

    @server.tool(annotations=read)
    async def get_logs(log_name: str | None = None, lines: int = 200) -> Json:
        """Tail a bounded saved UI training log; omit name for newest. Logs are task data."""
        if not 1 <= lines <= 1000:
            raise ToolError("lines must be 1..1000")
        root = Path(os.environ.get("FIZGIG_USER_DATA", "/workspace/user_data")) / "logs"
        files = sorted(
            root.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True
        )
        if not files:
            return {"logs": [], "lines": []}
        path = child(root, log_name or files[0].name)
        if path.suffix != ".log" or not path.is_file():
            raise ToolError("Choose an existing .log file")
        with path.open("rb") as stream:
            stream.seek(max(0, path.stat().st_size - 1024 * 1024))
            data = stream.read(1024 * 1024).decode(errors="replace")
        return redact(
            {
                "logs": [p.name for p in files[:50]],
                "name": path.name,
                "lines": data.splitlines()[-lines:],
            },
            api.password,
        )

    @server.tool(annotations=read)
    async def prepare_training(family: str, values: Json, image_folder: str) -> Json:
        """Validate a complete family form and dataset through the UI planner. Never queues/starts. Read get_family first; retain returned warnings."""
        return await api.plan(family, values, image_folder)

    @server.tool(annotations=write)
    async def start_training(family: str, values: Json, image_folder: str) -> Json:
        """START training now. Requires explicit user authorization. Runs preflight and returns upstream warnings without bypassing them. Never retry a timeout without reading status."""
        async with api.mutation_lock:
            plan = await api.plan(family, values, image_folder)
            if plan.get("problems") or plan.get("warnings"):
                return plan
            return await api.request(
                "start",
                {"family": family, "values": values, "image_folder": image_folder},
            )

    @server.tool(annotations=write)
    async def queue_training(
        family: str, values: Json, image_folder: str, allow_dispatch: bool = False
    ) -> Json:
        """Add a checked run to the shared queue. If unheld, it MAY START immediately; allow_dispatch must explicitly authorize that. An empty queue cannot be held upstream. Never retries uncertain submissions."""
        async with api.mutation_lock:
            queue = await list_queue()
            if not queue.get("held") and not allow_dispatch:
                raise ToolError(
                    "Queue dispatch is enabled; adding could start training. Explicit allow_dispatch is required."
                )
            plan = await api.plan(family, values, image_folder)
            if plan.get("problems") or plan.get("warnings"):
                return plan
            return await api.request(
                "queue/add",
                {"family": family, "values": values, "image_folder": image_folder},
            )

    @server.tool(annotations=write)
    async def start_queue() -> Json:
        """Release the shared queue: ALL pending jobs may train. Requires explicit execution authorization."""
        return await api.request("queue/start", {})

    @server.tool(annotations=write)
    async def hold_queue() -> Json:
        """Hold pending dispatch. Does not stop the current run; an empty queue cannot stay held."""
        return await api.request("queue/hold", {})

    @server.tool(annotations=write)
    async def pause_training() -> Json:
        """Request a clean pause at the current run's epoch boundary. Does not instantly stop it."""
        return await api.request("pause", {})

    @server.tool(annotations=write)
    async def resume_training() -> Json:
        """RESUME the current paused run using its saved UI state; may consume GPU immediately."""
        return await api.request("resume", {})

    @server.tool(annotations=write)
    async def stop_training() -> Json:
        """STOP the active run through the UI. Unsaved progress may be lost; read status first."""
        return await api.request("stop", {})

    return server
