# Fizgig Web UI (Modern Linear-Dark Front-End)

A high-density, modern web interface for [Fizgig](https://github.com/delfianto/fizgig-docker) LoRA/fine-tuning trainer built with Vue 3.5, VoidZero Vite+ (`vp`), TypeScript, Tailwind CSS 4, DaisyUI 5, and Pinia 4.

## Key Enhancements over Upstream

1. **Separation of Concerns (Cockpit vs. Composer)**:
   - Upstream Fizgig mixed active training controls, a 4,300px-tall hyperparameter form, and live telemetry inside a single `ttk.Notebook` tab (`5. Training`).
   - The new UI splits these into dedicated workspaces:
     - **Live Cockpit (`/cockpit`)**: Real-time KPI strip, smoothed EMA loss curve with outlier clipping, multi-epoch sample preview comparison matrix, live safetensors checkpoint browser with direct downloads, and streaming server logs.
     - **Run Composer (`/composer`)**: Progressive disclosure architecture offering an **Essential Studio** mode (clean 80/20 workflow with dataset picker, wand auto-naming, trigger tokenizer check, recipe math pills, quick epoch buttons, and preflight launch station) and an **Expert Tuning** mode (7 organized bays for granular control over all 35+ hyperparameters with live search).
     - **Dataset Studio (`/datasets`)**: Master-detail browser, inline image caption editor with instant saving, trigger word tokenizer inspector, bulk find/replace with dry-run preview, and aspect-ratio bucketing tool.
     - **Workbench (`/workbench`)**: Parametric 38-block transformer weight equalizer with 5 category master sliders (Composition, Identity, Structure, Lighting, Texture), epoch tournament arena, and safetensors header metadata viewer.
     - **System & Catalog (`/system`)**: First-class integration with `fizgig-docker` declarative model bundles (`models.json`), GPU/VRAM telemetry, and UI density toggle.

2. **Accidental Override Prevention**:
   - Upstream checked `__SAMPLE_LIVE` by default, which silently overwrote active training sample prompts with `"A high quality photo"` whenever a preset was clicked.
   - The new UI keeps Composer draft values completely isolated from active runs. Live sample prompts can only be changed via an explicit slide-out drawer (`Live Prompts…`).

3. **Strict Tailwind CSS v4 Canonical Classes (`suggestCanonicalClasses`)**:
   - Zero arbitrary variable brackets (`border-[var(--color-hairline)]`, `text-[var(--color-muted)]`, `bg-[var(--color-canvas)]`).
   - All design tokens are registered as first-class theme utilities in `@theme` (`border-hairline`, `border-hairline-strong`, `text-muted`, `text-subtle`, `bg-canvas`, `bg-hairline`, `divide-hairline`, `hover:bg-surface-hover`).

4. **High-Performance Build & DX**:
   - Powered by VoidZero Vite+ (`vp`) with Oxlint and Oxfmt for sub-second build times and zero-lint-error standard.

## Running Locally

### Development Mode

```bash
cd webui
# Uses VoidZero Vite+ launcher
vp dev --host 0.0.0.0 --port 8084
```

Access the UI at `http://127.0.0.1:8084/`. The integrated BFF proxy automatically handles session authentication against the running Fizgig container (`http://127.0.0.1:8082`), reading the password from `/srv/appdata/secret/fizgig_password`.

### Production Build & Preview

```bash
cd webui
# Typecheck, check/fix code style, and build
bun run typecheck
bun run check:fix
bun run build

# Preview production build
vp preview --host 0.0.0.0 --port 8084
```

## Workspaces & Keyboard Shortcuts

- `Alt + 1`: **Cockpit** (`/cockpit`) — Live training telemetry, loss curve, sample matrix, checkpoint downloads.
- `Alt + 2`: **Composer** (`/composer`) — Model family, preset selection, hyperparameters, preflight validation.
- `Alt + 3`: **Datasets** (`/datasets`) — Caption studio, tokenizer inspector, bulk replace, image prep.
- `Alt + 4`: **Workbench** (`/workbench`) — Parametric block equalizer, LoRA Royale, metadata inspector.
- `Alt + 5`: **System** (`/system`) — Model catalog, mount roots, hardware metrics, density toggle.

## Project Structure

```
webui/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .oxlintrc.json
├── .oxfmtrc.json
├── shared/
│   └── types.ts            # Shared TypeScript contracts and schema interfaces
├── server/
│   └── fizgig-proxy.ts     # Authenticated BFF proxy & local catalog resolver
└── src/
    ├── main.ts             # Vue 3 + Pinia + Vue Router initialization
    ├── App.vue             # Shell layout (64px Icon Rail + 44px Telemetry Bar)
    ├── app.css             # Tailwind v4 + DaisyUI 5 Linear-dark theme
    ├── api/
    │   └── client.ts       # Typed fetch wrapper and media URL builders
    ├── stores/
    │   ├── composer.ts     # Reactive draft hyperparameters and validation
    │   ├── run.ts          # Active run telemetry, loss curve, samples, and queue
    │   ├── schema.ts       # Upstream family schemas, presets, and datasets
    │   └── system.ts       # Local bundles catalog, UI density, and preferences
    ├── components/
    │   ├── schema/
    │   │   └── SchemaField.vue         # Polymorphic input renderer for all 13 Fizgig kinds
    │   ├── shell/
    │   │   ├── AppIconRail.vue         # 64px left navigation rail
    │   │   └── TopTelemetryBar.vue     # 44px top GPU VRAM / RAM / Queue header
    │   └── telemetry/
    │       ├── LivePreviewDrawer.vue   # Isolated drawer for live sample overrides
    │       ├── LossChartCanvas.vue     # Canvas loss curve with EMA smoothing
    │       └── SampleMatrixGrid.vue    # Multi-epoch sample preview grid & A/B crossfader
    └── pages/
        ├── CockpitPage.vue             # Live Cockpit, Queue, and Run History
        ├── ComposerPage.vue            # 3-Column hyperparameter composer
        ├── DatasetsPage.vue            # Caption Studio & Image Prep
        ├── WorkbenchPage.vue           # Block Studio Equalizer & LoRA Royale
        └── SystemPage.vue              # Hardware status & models.json bundles
```
