# 05 — Backend Shim Architecture, Upstream API Contract & Zero-Disruption Workflow

## 1. Architectural Overview: How the Shim Talks to Fizgig

Inside the `fizgig` container, upstream Fizgig runs its built-in HTTP server on `127.0.0.1:8081` (mapped on the host to `127.0.0.1:8082`), and `fizgig-docker` already runs an authenticated Starlette + Uvicorn companion process (`src/fizgig_mcp/server.py`) on `0.0.0.0:8083` (mapped on the host to `127.0.0.1:8083`).

```
+-----------------------------------------------------------------------------------+
| HOST MACHINE                                                                      |
|                                                                                   |
|  1. Zero-Disruption Dev Mode (While Training is Active):                          |
|     Browser (:5173) ---> Vite+ Dev Server ---> Host Shim (:8084)                  |
|                                                    |                              |
|                                                    | HTTP + X-Fizgig-Token        |
|                                                    v                              |
|                                           127.0.0.1:8082                          |
+----------------------------------------------------|------------------------------+
                                                     |
+----------------------------------------------------v------------------------------+
| FIZGIG DOCKER CONTAINER                            |                              |
|                                                    v                              |
|  Upstream Fizgig Web/API (:8081) <------- Companion Starlette Server (:8083)      |
|  - Owns active training subprocess        - Serves /mcp (Bearer Auth)             |
|  - Owns queue, history, studio worker     - Serves /ui/* (Compiled Vue SPA)       |
|  - Exposes ~110 /api/* endpoints          - Serves /ui-api/* (Authenticated BFF)  |
+-----------------------------------------------------------------------------------+
```

### Why a Lightweight Python BFF Layer (`ui_routes.py`) in `fizgig_mcp` Is Ideal
1. **Zero Token-Scraping in the Browser:** Upstream Fizgig generates a random in-memory token on startup, embeds `<meta name="fizgig-token" content="...">` in `GET /`, and requires `X-Fizgig-Token` on every `/api/*` call after `POST /api/login`. [`FizgigAPI`](../../src/fizgig_mcp/adapter.py) **already solves this** with `asyncio.Lock()`, automatic token extraction, login, and 401/403 re-login retry.
2. **Streaming Binary Media & Thumbnails:** In addition to JSON routes, the UI needs image thumbnails (`/api/thumb`), sample previews (`/api/media`), checkpoint downloads (`/api/download`), and dataset uploads (`/api/upload`). Adding a streaming proxy helper to `FizgigAPI` lets the Vue SPA request `/api/thumb?...` and `/api/media?...` seamlessly.
3. **Native `fizgig_local` Manifest Bundle Endpoints:** Upstream Fizgig knows nothing about `/etc/fizgig/models.json` or ComfyUI's `/catalog` manifest. Our Python BFF exposes `/ui-api/local/bundles` and `/ui-api/local/bundles/validate` directly from `fizgig_local.catalog.Catalog` so the **System** workspace can display and preflight manifest bundles natively.

---

## 2. Zero-Disruption Workflow (Developing While `jeje_krea2_1216` Trains)

Because `fizgig` already publishes `127.0.0.1:8082->8081/tcp` on the host, **zero container restarts or image rebuilds are needed to build and use the custom UI right now**:

1. **Host BFF Process (`127.0.0.1:8084`):**
   - Run the Starlette UI BFF directly on the host using `.venv`, pointing at:
     - `FIZGIG_API_URL=http://127.0.0.1:8082`
     - `FIZGIG_AUTH_FILE=/srv/appdata/secret/fizgig_password`
     - `FIZGIG_MODEL_CATALOG=/srv/appdata/fizgig/config/models.json`
     - `FIZGIG_MANIFEST_ROOT=/srv/appdata/comfyui/manifest/models`
     - `FIZGIG_MODELS_ROOT=/srv/appdata/comfyui/models`
2. **Vite+ Dev Server (`127.0.0.1:5173`):**
   - Run `vp dev` inside `/srv/project/github/fizgig-docker/ui`.
   - Vite proxies `/api/*` and `/ui-api/*` to `http://127.0.0.1:8084`.
   - You get instant Hot Module Replacement (HMR) connected to the live `jeje_krea2_1216` training run with **0% risk** to the running container.
3. **Container Packaging (After Training Finishes):**
   - `Dockerfile` builds `ui/dist` in a Node/Vite+ build stage and copies the static bundle into `/opt/fizgig-local/ui_dist`.
   - `fizgig_mcp.server` mounts the UI routes and static files so the container serves the new UI out of the box on next `composectl update`.

---

## 3. Complete Upstream Fizgig `/api/*` Reference

All routes below are served by `/opt/Fizgig/src/fizgig/web/server.py` on port `8081` (`127.0.0.1:8082` on host) and require the `X-Fizgig-Token` header after `POST /api/login`.

### 3.1 Core Schema, Form State & Presets

| Method | Path | Request Params / JSON Body | Response Shape & Notes |
| --- | --- | --- | --- |
| `GET` | `/api/schema` | None | `{ families: FamilyDesc[], order: string[], news: NewsItem[] }`. Each family has `key`, `display_name`, `gui_label`, `media`, `model_files`, `model_keys`, `presets`, `block_categories`, and `form: { sections: Section[], presets: Preset[] }`. |
| `POST` | `/api/form/state` | `{ family, values, image_folder }` | **Read-only compute POST.** Returns `{ kind, hidden: string[], disabled: string[], notes: Record<string, string>, placeholders: Record<string, string>, pending: boolean }`. Includes live VRAM batch plan (`notes.BATCH_SIZE`) and multi-person folder diagnostics. |
| `GET` | `/api/presets` | `?family=<key>` | `{ builtin: string[], user: string[] }` |
| `POST` | `/api/preset` | `{ family, name, values }` | **Read-only compute POST.** Merges preset `name` over `values` and returns `{ values: Record<string, any> }`. |
| `POST` | `/api/preset/save` | `{ family, name, values, overwrite?: boolean }` | Saves user preset JSON under `user_data/presets/<gui_label>/<name>.json`. Returns `{ ok: true, user: string[] }` or `{ exists: true }`. |
| `GET` | `/api/state` | None | Returns saved UI draft state `{ family, image_folder, tab, values: Record<family, Record<key, val>>, captions, prep }`. |
| `POST` | `/api/state` | Partial state object | Updates `user_data/web_state.json`. *(In our custom UI, `useComposerStore` manages draft state cleanly without triggering side-effects).* |

### 3.2 Live Training Run, Telemetry, Logs & Controls

| Method | Path | Request Params / JSON Body | Response Shape & Notes |
| --- | --- | --- | --- |
| `GET` | `/api/run` | None | `{ state, stage, running, lora, output_dir, family, values, image_folder, pause, resume, history_id, progress: { epoch, total_epochs, step, total_steps, speed, loss, eta, percent, lr, grad_norm, note }, started_at, training_at, web_queue: { items, held, reason, waiting } }`. |
| `GET` | `/api/stats` | None | `{ vram: [used, total], ram: [used, total], vram_peak, ram_peak, device_name, disk: { used, total, free, where, path }, jobs: [], loaded: [{ what, name, tab }] }`. |
| `GET` | `/api/log` | `?pos=<byte_offset>` | `{ text: string, pos: number, reset: boolean }`. Incremental log reader for active run console stdout. |
| `POST` | `/api/plan` | `{ family, values, image_folder }` | **Read-only preflight validation.** Returns `{ ok: boolean, problems: string[], warnings: string[], summary: Record<string, any> }`. Never starts training. |
| `POST` | `/api/start` | `{ family, values, image_folder }` | Starts training immediately if GPU is idle. |
| `POST` | `/api/pause` | `{}` | Requests clean pause at the next epoch boundary (`pause: true`). |
| `POST` | `/api/resume` | `{ family?, values?, image_folder? }` | Resumes a paused run from its saved state. |
| `POST` | `/api/stop` | `{}` | Terminates active training subprocess. |
| `POST` | `/api/run/now` | `{ kind: "sample" \| "save" }` | Signals active trainer to generate sample previews or save a checkpoint at the end of the current step. |
| `POST` | `/api/run/sample_override` | `{ on: boolean, prompts: string, seed, width, height, steps, cfg, turbo, every, until, after }` | Writes or deletes `<output_dir>/.sample_override.json` for the active run. **Must only be called from `LivePreviewDrawer.vue` upon explicit user confirmation.** |
| `POST` | `/api/run/slider_prompts` | `{ pos, neg, anchor }` | Updates live slider training prompts for the next epoch boundary. |

### 3.3 Queue, Run History, Samples & Checkpoints

| Method | Path | Request Params / JSON Body | Response Shape & Notes |
| --- | --- | --- | --- |
| `GET` | `/api/queue/item` | `?id=<queue_id>` | Full `{ id, family, values, image_folder }` of a queued job. |
| `POST` | `/api/queue/add` | `{ family, values, image_folder }` | Appends job to `web_queue`. *(Note: starts immediately if GPU is idle and queue is unheld).* |
| `POST` | `/api/queue/update` | `{ id, family, values, image_folder }` | Updates an existing queued job in-place. |
| `POST` | `/api/queue/remove` | `{ id }` | Removes item from queue. |
| `POST` | `/api/queue/move` | `{ id, dir: -1 \| 1 }` or `{ id, to: index }` | Reorders queue item. |
| `POST` | `/api/queue/start` | `{}` | Releases queue hold (`held: false`) and dispatches next pending job. |
| `POST` | `/api/queue/hold` | `{}` | Holds queue dispatch (`held: true`). *(Note: upstream only holds non-empty queues).* |
| `GET` | `/api/runs` | None | `{ runs: HistoricalRun[] }` with `id`, `lora`, `family`, `image_folder`, `output_dir`, `started_at`, `finished_at`, `status`, `loss_spark`, `lowest_loss`, `lowest_epoch`, `notes`, `values`. |
| `GET` | `/api/runs/loss` | `?id=<run_id>` or `?live=1` | `{ points: [[step, loss, epoch, lr], ...], epochs: [...] }` for plotting the interactive loss chart. |
| `GET` | `/api/runs/image_loss` | `?id=<run_id>` or `?live=1` | Per-image residual history across epochs for the Loss Watch heatmap. |
| `POST` | `/api/runs/notes` | `{ id, notes }` | Saves user markdown/text notes on a historical run. |
| `POST` | `/api/runs/continue` | `{ id, epochs }` | Continues or queues a completed/stopped run from its latest saved state. |
| `POST` | `/api/runs/delete` | `{ id, confirm: boolean }` | `confirm: false` returns `{ files: string[], bytes: number }` preview; `confirm: true` deletes run & files. |
| `GET` | `/api/samples` | `?dir=<sample_dir>&run=<lora_name>` | `{ items: SampleItem[], prompts: string[], style_on: boolean, likeness_refs: string[] }`. |
| `GET` | `/api/checkpoints` | `?dir=<output_dir>` | `{ items: [{ name, path, run, size, mtime, epoch }] }`. |
| `GET` | `/api/outputs` | None | Lists all `.safetensors` outputs across Fizgig output directories. |
| `GET` | `/api/thumb` | `?path=<container_path>&size=<px>` | Returns JPEG/WebP thumbnail binary stream. |
| `GET` | `/api/media` | `?path=<container_path>` | Returns full-resolution PNG/WebP/MP4/Audio binary stream. |
| `GET` | `/api/download` | `?path=<container_path>` | Streams checkpoint or archive with `Content-Disposition: attachment`. |

### 3.4 Datasets, Image Prep, Masks & Captions

| Method | Path | Request Params / JSON Body | Response Shape & Notes |
| --- | --- | --- | --- |
| `GET` | `/api/datasets` | None | `{ datasets: [{ name, path, count, captioned, mtime, size }] }`. |
| `GET` | `/api/browse` | `?path=<dir>&dir=1` | Directory/file browser inside container. |
| `GET` | `/api/trigger` | `?folder=<path>` | Reads inferred or saved trigger word for a dataset folder. |
| `GET` | `/api/captions` | `?folder=<path>&ext=.txt` | `{ items: [{ name, path, caption, width, height, removed }], removed_count: number }`. |
| `POST` | `/api/captions/save` | `{ path, text, ext }` | Atomically writes a single image's `.txt` caption. |
| `POST` | `/api/captions/trigger_check` | `{ family, trigger }` | Tokenizes `trigger` against the selected family's actual tokenizer (`CLIP` / `Qwen3-VL` / `T5`) and returns token count + token breakdown. |
| `POST` | `/api/captions/replace` | `{ folder, find, replace, preview: boolean }` | Bulk case-insensitive Find & Replace across `.txt` files (`preview: true` returns diff list without writing). |
| `POST` | `/api/captions/add` | `{ folder, prefix, suffix, preview: boolean }` | Bulk prepend/append trigger or tags across dataset captions. |
| `GET` | `/api/captions/options` | `?family=<key>` | Available local AI captioner models (`Qwen3-VL`, etc.) and task templates. |
| `POST` | `/api/captions/ai` | `{ folder, model, task, trigger, max_tokens, overwrite }` | Starts batch AI captioning job; poll `GET /api/captions/status`. |
| `GET` | `/api/prep/options` | None | Image prep options and whether face detection weights are installed. |
| `GET` | `/api/prep/summary` | `?folder=<path>&mode=...&mp=...` | Dry-run summary of what Image Prep will resize/crop. |
| `POST` | `/api/prep/run` | `{ folder, mode, mp, face, pad, keep_originals }` | Runs Image Prep; poll `GET /api/prep/status`. |
| `GET` | `/api/masks/info` | `?folder=<path>` | Mask coverage status for dataset folder. |
| `POST` | `/api/masks/edit/sam_click` | `{ path, points: [[x, y, label]] }` | Interactive SAM 3.1 point-to-mask segmentation. |

### 3.5 Post-Training Workbenches (`Studio`, `Royale`, `Profiler`, `Extract`, `Metadata`)

| Subsystem | Endpoints | Purpose |
| --- | --- | --- |
| **Block Studio** | `GET /api/studio/families`, `GET /api/studio/layout`, `GET /api/studio/status`, `GET /api/studio/image`, `GET /api/studio/metrics`, `POST /api/studio/load`, `POST /api/studio/render`, `POST /api/studio/save`, `POST /api/studio/unload` | Loads model + LoRA into persistent GPU worker, returns block layout & categories, renders baseline vs. block-tweaked preview on slider change (cancel-and-refire), and exports repaired `.safetensors`. |
| **LoRA Royale** | `GET /api/royale/info`, `GET /api/royale/scan`, `GET /api/royale/status`, `GET /api/royale/image`, `POST /api/royale/render`, `POST /api/royale/travel`, `POST /api/royale/score`, `POST /api/royale/export` | Scans epoch checkpoints, batch-renders fixed-seed previews across epochs, computes face likeness scores against reference photos, and runs Seed/Strength/Prompt travel. |
| **Profiler** | `GET /api/profile/info`, `GET /api/profile/prefill`, `GET /api/profile/status`, `GET /api/profile/report`, `POST /api/profile/run`, `POST /api/profile/stop` | Measures per-block weight norms, update velocity, and saturation across epochs. |
| **Extract & Metadata** | `GET /api/extract/info`, `POST /api/extract/run`, `POST /api/extract/finetune`, `GET /api/metadata`, `POST /api/metadata/save`, `POST /api/metadata/thumbnail` | LoRA rank extraction/resizing and `.safetensors` header-only ModelSpec metadata + thumbnail editing. |
