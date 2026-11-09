# Fizgig

Fizgig in a browser, with an authenticated [MCP companion](docs/mcp.md), explicit
selections from a ComfyUI model manifest, read-only shared weights and offline
training workers. Image/container: `fizgig`.
Source project: [`delfianto/fizgig-docker`](https://github.com/delfianto/fizgig-docker).
Deployment belongs in the separate Compose
repository at `ai/fizgig`; credentials, runtime catalogues and weights stay there
or in appdata. No application code is bind-mounted into production.

## Repository Layout

- [`webui/`](webui/README.md): Modern Linear-dark Web UI front-end built with Vue 3.5, VoidZero Vite+ (`vp`), native TypeScript 7, Tailwind CSS 4, and DaisyUI 5. Provides high-density Cockpit telemetry, progressive-disclosure Composer, and Dataset Studio.
- [`mcp/`](mcp/README.md): Python project root containing the Model Context Protocol (`fizgig_mcp`) server, container HTTP adapters, and offline model catalog resolver (`fizgig_local`).
- [`docker/`](docker/): Container entrypoint scripts and dependency manifests for Docker packaging.
- [`docs/`](docs/): Architecture documentation, UI/UX audits, and MCP protocol specifications.

## Build

```sh
docker build -t local/fizgig:dev -t ghcr.io/delfianto/fizgig:latest .
```

The Dockerfile defaults to the latest upstream HEAD (or an optional pinned commit
via `--build-arg UPSTREAM_COMMIT=<sha>`). Source and dependency updates happen at build time. The image never runs
upstream's cloud entrypoint, clones source at startup, or installs packages on a
restart. Upstream source and its licence stay in `/opt/Fizgig`. Building pulls the
runtime image and Python dependencies, but never model weights.

The GitHub workflow checks upstream HEAD nightly, fingerprints the source,
runtime-image digest and wrapper commit, and skips an already published build.
Pushes to `main` publish `ghcr.io/delfianto/fizgig:latest` through GitHub Actions
using `GITHUB_TOKEN` with package write permission. Compose uses that image name
directly. Scheduled builds publish a new image when upstream inputs change;
running services are updated separately through `composectl update`.

## Existing models and custom filenames

Mount ComfyUI's `manifest/models` at `/catalog` and its `models` at `/models`, both
read-only. Mount a deployment selection file at `/etc/fizgig/models.json`.
[`examples/models.json`](examples/models.json) shows reviewed initial selections.

A checkpoint reference uses the existing family and stable ID. The resolver reads
the current path from that family's `inventory.json`, so a catalogue rename does
not require renaming the model for Fizgig. Components without stable IDs use their
exact catalogued relative path. That reference must be updated if the component
is renamed. Explicit external roots can reuse older assets, such as Toolkit's
FP8 Qwen3-VL encoder, without copying them into ComfyUI's catalogue.

At startup all active selections are checked before changing preferences. A fresh
UI opens on the first active bundle's family; existing UI state is retained. The
resolver checks existence, recorded file sizes, safetensors headers and known
format restrictions, then writes absolute component paths into Fizgig's own
`prefs.json`. It preserves unrelated settings and clears optional overrides for
the selected family. No model copies, filename aliases, tensor conversion or
model downloads occur. Recorded size is checked; full payload hashes are not
recomputed at every startup.

```sh
docker exec fizgig python3 -m fizgig_local list
docker exec fizgig python3 -m fizgig_local validate
```

Edit the host selection file's `active` list and restart through the deployment's
service manager to switch bundles. Only one bundle per family can be active.
These active bindings are reapplied on restart; changing their paths only in the
UI lasts until the next restart. `apply` also supports explicit bundle names for
offline maintenance while the server is stopped. Do not run it against live
preferences because the UI can write those concurrently.

## Format compatibility

Naming compatibility and checkpoint compatibility are separate. The initial
integration enables Krea 2, plain BF16/FP16 Anima and complete SDXL checkpoints.
Other families require reviewed bundles and format checks in the resolver.

- Krea 2's current transformer loader decodes INT8 ConvRot and handles scaled
  FP8 checkpoints. Its Qwen3-VL text encoder loader supports BF16/scaled FP8,
  but not the shared INT8 ConvRot encoder. Reuse Toolkit's existing FP8 copy.
- SDXL includes its VAE/text encoders inside a complete checkpoint. An explicit
  compatible VAE or encoder override is optional.
- The initial Anima selection is AniSee V2 Aesthetic BF16. The integration
  deliberately rejects quantised Anima assets; expanded architectures need a
  separate review.

The preflight is not proof of numerical compatibility or training quality. No
training job is started by image startup, validation or tests. Family loaders
remain upstream's, with no weakened state-dict checks.

## Runtime contract

| Path/setting | Purpose |
| --- | --- |
| `/workspace/user_data` | Preferences, presets, queue, logs and run history |
| `/workspace/output_loras` | Trained results, separate from shared weights |
| `/workspace/cache` | Disposable latents/conditioning |
| `/datasets` | Shared Toolkit datasets; writable for captions/preparation |
| `/toolkit-models` | Retained Toolkit model assets, read-only |
| `FIZGIG_PASSWORD` | Required login secret, at least 12 characters; never logged |
| `FIZGIG_OFFLINE=1` | Default; disables outbound connections from upstream UI/training Python except loopback/Unix sockets |
| `FIZGIG_MODEL_CATALOG` | Deployment's selection file |
| `FIZGIG_MANIFEST_ROOT`, `FIZGIG_MODELS_ROOT` | Defaults `/catalog`, `/models` |
| Port `8081` | Authenticated upstream browser UI/API |
| Port `8083` | MCP `/mcp`, using the existing Fizgig password as bearer authentication |

A site `.pth` hook in the training environment installs the offline policy in the
web server and its upstream Python workers, including explicit download helpers.
The MCP companion uses a separate environment and calls only the loopback UI API.
Missing tokenizers, captioners,
mask models or other assets fail locally. It is a runtime policy, not a security
sandbox. Remote helpers and online features require an intentional deployment
change to `FIZGIG_OFFLINE=0` and the corresponding HF offline variables. Incoming
browser/Traefik connections still work in offline mode. LAN discovery and update
checks default off. No RunPod lifecycle integration, filebrowser or SSH daemon is
started by this wrapper.

GPUs and lifecycle belong to Compose/systemd. The image does not reserve memory.
The homelab Compose project exposes both GPUs through CDI, following Toolkit.
Choose the training device and avoid overlapping large GPU jobs.

## Development

```sh
uv sync --locked --extra mcp
uv run --extra mcp python -m unittest discover -s tests -v
```

Tests use tiny synthetic headers and fake HTTP/MCP transports, never real tensors.
CI also imports the actual upstream web server and checks model preference keys
inside the built image. Perform an authenticated HTTP smoke test and model
preflight on the deployment host before starting training.

```sh
uv run python tools/smoke.py --url http://127.0.0.1:8082 \
  --password-file /srv/appdata/secret/fizgig_password
```

This reads the password locally and never prints it. It checks the login and
authenticated schema/preferences/state APIs; it does not start training.
