# 03 — Layout Architecture & Workspace Specifications

## 1. Application Shell (`100vh` Zero-Bleed Layout)

The fake desktop `.window-titlebar`, the 3.5-second `#bootCover` delay, and the 14-item vertical tab list are replaced by a clean **two-axis developer shell**:

```
+------+---------------------------------------------------------------------------------------+
|      | TOP TELEMETRY & QUICK-ACTION BAR (44px fixed, #0c0d0f, 1px bottom hairline)           |
| LOGO | [● Running: jeje_krea2_1216 | Ep 4/30 · 962/8190 (12%) | Loss 0.0441 | ETA 12:00:40]  |
| 64px | [Sample Now] [Save Now] [Pause]   ||   GPU: RTX 4080 [==== 14.0/16.0 GB] RAM 28/60 GB |
+------+---------------------------------------------------------------------------------------+
|      |                                                                                       |
| [⚡] |                                                                                       |
| COCK |                                                                                       |
| PIT  |                                                                                       |
|      |                                                                                       |
| [🎛] |                                                                                       |
| COMP |                        ACTIVE WORKSPACE CANVAS (#0b0c0e)                              |
| OSER |                  (Independent pane scroll, split-panel layouts,                       |
|      |                   zero global page scroll, instant route switch)                      |
| [🗂] |                                                                                       |
| DATA |                                                                                       |
| SETS |                                                                                       |
|      |                                                                                       |
| [🔬] |                                                                                       |
| LAB  |                                                                                       |
|      |                                                                                       |
| ---- |                                                                                       |
| [⚙]  |                                                                                       |
| SYS  |                                                                                       |
+------+---------------------------------------------------------------------------------------+
```

### 1.1 Left Icon Rail (`64px` fixed width, `#0c0d0f`)
- **5 Primary Destinations** (with instant keyboard shortcuts `Alt+1`..`Alt+5` and tooltips):
  1. **Cockpit (`/cockpit`)** — `Activity` icon + live pulsing amber ring when `run.running === true` + queue count badge.
  2. **Composer (`/composer`)** — `SlidersHorizontal` icon + dirty indicator dot when draft differs from saved preset.
  3. **Datasets (`/datasets`)** — `Images` icon (Dataset Browser, Image Prep, SAM 3.1 Masks, Caption Studio).
  4. **Workbench (`/workbench`)** — `FlaskConical` icon (LoRA Royale, Block Studio, Profiler, Extract, RefMod, Metadata).
  5. **System (`/system`)** — `Settings` icon pinned to the bottom (`fizgig_local` Model Bundles, Paths, GPU, Helpers, Appearance).
- **Smart Initial Route:** If a training job is actively running on initial page load, the app opens directly on **Cockpit (`/cockpit`)**—never forcing the user back to a release-notes screen. Otherwise, it restores the user's last active route.

### 1.2 Persistent Top Telemetry Bar (`44px` height, `#0c0d0f`)
Visible from every workspace so the user never loses sight of hardware or active training state:
- **Left Cluster (Active Run Pill):**
  - When **Running / Starting / Pausing**: Pulsing amber status ring, LoRA name (`jeje_krea2_1216`), family badge (`Krea 2`), compact progress bar, `Ep 4/30 · Step 962/8190`, `5.98 s/it`, `Loss 0.0441`, `ETA 12:00:40`, mini 60 px SVG loss sparkline, and 1-click buttons: `Sample Now`, `Save Now`, `Pause`, and `Stop` (with confirmation popover).
  - When **Idle**: Muted badge `Idle · Queue: 0 pending (Unheld)` and quick link to `Composer`.
- **Right Cluster (Hardware Telemetry):**
  - GPU badge (`RTX 4080`), VRAM progress meter (`14.0 / 16.0 GB · Peak 14.1 GB`), System RAM meter (`28.1 / 60.2 GB`), Output disk free badge (`744 GB free`), and active worker pill (e.g., `Training`, `Studio loaded`, `Captioner loaded` with 1-click `Unload` button when idle).

---

## 2. Workspace 1: Cockpit (`/cockpit`) — Live Run, Samples, Queue & History

Replaces the bottom half of `5. Training`, the gallery of `4. Samples`, and `Runs & outputs`.

### 2.1 Layout Grid (`12-column` split workspace)

```
+---------------------------------------------------+------------------------------------------+
| SUB-NAV: [● Live Run] [Queue (0)] [Run History]   | SAMPLE VIEW: [Matrix: Prompt × Epoch ▾]  |
+---------------------------------------------------+------------------------------------------+
| KPI STRIP (6 compact mono cards):                 | EPOCH × PROMPT SAMPLE MATRIX             |
| [Epoch 4/30] [Step 962/8190] [Speed 5.98s/it]     | (Sticky Prompt column headers,           |
| [Loss 0.0441] [Grad 0.055] [LR 1.00e-04]          |  scrollable Epoch rows newest-first)     |
+---------------------------------------------------+                                          |
| INTERACTIVE LOSS & RESIDUAL CHART (320px height)  |         | Prompt 1     | Prompt 2        |
| Toolbar: [Smooth: 0.6] [Log] [Clip] [+LR] [+EMA]  | --------+--------------+---------------- |
|          [Tab: Step Loss | Per-Image Loss Watch]  | Epoch 4 | [thumb]      | [thumb]         |
| +-----------------------------------------------+ |         | ★ 0.89 like  |                 |
| |   \      /\    /\_                            | | Epoch 3 | [thumb]      | [thumb]         |
| |    \____/  \__/   \________● Lowest: ep3      | | Epoch 2 | [thumb]      | [thumb]         |
| +-----------------------------------------------+ | Epoch 1 | [thumb]      | [thumb]         |
+---------------------------------------------------+------------------------------------------+
| BOTTOM TABS: [Checkpoints (3)] [Console Log] [Spec]          [⚙ Edit Live Preview Prompts…]  |
| - jeje_krea2_1216-000003.safetensors (224 MB) [DL]| (Explicit drawer — never auto-triggered) |
+---------------------------------------------------+------------------------------------------+
```

### 2.2 Key UX Upgrades in Cockpit
1. **Side-by-Side Loss Curve + `Epoch x Prompt` Matrix:**
   - Hovering an epoch marker (`e1`, `e2`, `e3`, `e4`) on the loss chart highlights the corresponding epoch row in the Sample Matrix on the right.
   - Clicking any thumbnail opens the **Compare Lightbox**, which supports:
     - **Epoch Scrubber (`Left/Right` arrows):** Flip through Epochs `1..N` for the same prompt with zero layout shift.
     - **A/B Split & Crossfade Slider:** Pin `Epoch 2` on the left and scrub `Epoch 4` on the right, with zoom/pan locked together.
     - **Likeness & Style Scores:** Toggle `/api/likeness` (3 reference dataset photos) and `/api/style` directly in the gallery header.
2. **Integrated Per-Image Loss Watch Tab:**
   - Switching the chart header from `Step Loss` to `Per-Image Loss Watch` (`/api/runs/image_loss`) renders a sortable residual heatmap showing which training images have high/stuck loss across epochs, with inline click-to-inspect and caption quick-fix (`/api/runs/caption`) without leaving the Cockpit.
3. **Safe, Explicit Live Preview Override Drawer (Fixing the `.sample_override.json` Footgun):**
   - Upstream's default-on `Change the previews of the run going now` checkbox is **abolished**.
   - In the Cockpit, the active run's current prompts are shown read-only. If the user wants to change the running job's preview prompts, steps, CFG, or Turbo strength mid-run, they click **`Edit Live Preview Prompts...`** in the Cockpit, edit a dedicated modal/drawer pre-populated with the *running job's* actual prompts (`run.values.SAMPLE_PROMPT`), and explicitly click **`Apply Override to Active Run`** (or **`Clear Override & Restore Original Prompts`**).
4. **Queue & Run History Sub-Views:**
   - **Queue Drawer/Tab:** Drag-and-drop reorder (`/api/queue/move`), `Hold Queue` / `Start Queue` toggle with explicit dispatch confirmation, inline parameter diff summary for each queued job, and `Load into Composer to Edit` (`/api/queue/item`).
   - **Run History Table:** Searchable table of all past runs (`/api/runs`) with inline loss sparkline, duration, peak VRAM, checkpoint count, notes editor (`/api/runs/notes`), `Clone Settings to Composer`, `Continue Training`, and `Delete Run` (with two-step file preview via `/api/runs/delete` `confirm: false`).

---

## 3. Workspace 2: Composer (`/composer`) — Isolated High-Density Run Builder

Replaces `1. Start` (model/dataset selection), `4. Samples` (preview settings), and the top half of `5. Training` (hyperparameters).

### 3.1 Isolated State Guarantee
- `useComposerStore` holds the draft configuration (`family`, `presetName`, `imageFolder`, `values`, `baselinePresetValues`).
- Changing models, presets, datasets, or prompts in `Composer` **never** calls `/api/run/sample_override` and **never** mutates the active run.
- A persistent banner in Composer shows whether the GPU is currently busy (`Active run in progress: Start Training is replaced by Add to Queue (Held/Unheld)`).

### 3.2 Three-Column High-Density Workbench Layout (Fits in a Single 1080p Viewport)

```
+--------------------------------------------------------------------------------------------------+
| COMPOSER HEADER BAR                                                                              |
| Model: [Krea 2 ▾] (Bundle: krea2-int8 ✓) | Preset: [✨ Krea 2 Ultra Fast ▾] [Save…] [Reset (2)]  |
| Mode:  (● Standard LoRA) (○ Slider) (○ Fine-tune)   ||  [Check Plan] [Add to Queue] [▶ Start]    |
+-------------------------------+----------------------------------+-------------------------------+
| COL 1: DATA & OUTPUT (320px)  | COL 2: CORE HYPERPARAMETERS      | COL 3: PREVIEWS & PREFLIGHT   |
| ----------------------------- | -------------------------------- | ----------------------------- |
| TRAINING DATASET              | NETWORK & LENGTH (3-col grid)    | SAMPLE PREVIEWS ([x] Enabled) |
| [/datasets/yd66_v1     ] [..] | Type: [LoRA (standard) ▾]        | Cadence: Every [1] ep         |
| [273 imgs · 273 txt · 1.5 MP] | Rank (Dim): [ 32 ]  Alpha: [ 32 ]| [ ] Then from ep [10] ev [1]  |
| Quick pick (/datasets):       | Max Epochs: [ 30 ]  Seed:  [ 42 ]| Size: [1024] × [1024] Stp:[8] |
| • jeje_v1 (273)               | Save Every: [  1 ] ep            | CFG:  [1.0 ] Seed: [1234]     |
| • yd66_v1 (436) ●             | -------------------------------- | Turbo LoRA Str: [0.7]         |
| [ ] Include subfolders        | LEARNING RATE & OPTIMIZER        | ----------------------------- |
| ----------------------------- | [x] Adaptive LR  Min:[1e-4] Max:[4e-4]| SAMPLE PROMPTS (2 prompts) |
| OUTPUT & TRIGGER              | 💡 436 imgs: [Apply 1e-4 / 2e-4] | [Prompt Set: Default ▾] [Save]|
| LoRA Name:                    | Optimizer: [muon ▾] EMA: [0.98 ▾]| 1. [A close-up portrait of...]|
| [yd66_krea2_v1              ] | Args: [adjust_lr_fn=match_rms..] | 2. [A cowboy shot on beach...]|
| Output Dir:                   | -------------------------------- | [+ Add Prompt]                |
| [/workspace/output_loras (def)| RESOLUTION & BATCH               | Negative Prompt: [collapsed ▸]|
| Trigger Word:                 | Target MP: [1.5 ▾] Batch: [ 1 ]  | ----------------------------- |
| [yd66        ] [✓ 1 token]    | Stage MP:  [Off ▾] Until: [30%]  | PREFLIGHT & VRAM PLANNER      |
| ----------------------------- | 📊 Est. VRAM: 14.1 / 16.0 GB     | ✓ Dataset: 436 pairs valid    |
| CONTEXT LORA (Optional)       | -------------------------------- | ✓ Model bundle: 3/3 files OK  |
| [None                  ] [..] | QUALITY & AUTOMATION PILLS       | ⚠ LR note: large dataset      |
|                               | [x] Loss Watch [x] Per-Image LR  |                               |
|                               | [ ] Warmup Outliers [ ] Recaption|                               |
+-------------------------------+----------------------------------+-------------------------------+
| ADVANCED ACCORDION DRAWERS (Collapsed by default, showing live summary pills in header):         |
| [▸ Memory & Precision: Auto precision · Auto block swap · Auto compile · Grad accum 1]           |
| [▸ Masked Training & Captions: Masked Off · Dropout Off · .txt]                                  |
| [▸ Multi-Subject / DOP Isolation: 1 subject · Normal LoRA]                                       |
| [▸ Safetensors Metadata: Title, Author, License, Tags, Thumbnail]                                |
+--------------------------------------------------------------------------------------------------+
```

### 3.3 Hybrid Schema Renderer (Mapping All 13 Upstream Row `kind`s)
Upstream `/api/schema` defines 15 sections and 13 row `kind`s. Our `SchemaField.vue` component maps every `kind` to a clean DaisyUI 5 + Reka UI control while stripping the inline prose paragraphs into `?` popovers:

| Upstream `row.kind` | Upstream Keys | Custom UI Component Rendering |
| --- | --- | --- |
| `entry` | `key`, `label`, `default`, `suffix`, `action`, `turbo` | Compact `input input-sm` (`font-mono-num` for numeric keys) with inline right-aligned `suffix` unit badge and optional `action` button pill. |
| `combo` | `key`, `label`, `choices`, `labels` | `select select-sm` (or Reka UI `Combobox` when editable + preset list). |
| `choice` / `radio` | `key`, `label`, `choices`, `sets`, `timesteps` | Segmented pill bar (`join` / `tabs-box`) for `<= 4` choices (e.g., `Standard LoRA | Slider | Fine-tune`), or compact `select-sm` for longer lists. |
| `check` | `key`, `label`, `group`, `group_label`, `follow` | Compact `toggle toggle-xs toggle-primary` + label + `?` popover hint. Grouped checks (`KREA2_LOSS_WATCH`, `KREA2_PER_IMAGE_LR`, etc.) render as 2-column compact toggle chips. |
| `cadence` | `key`, `parts`, `tick_fills` | Inline single-row sentence control: `Every [N] epochs` + toggle `then from epoch [M] every [K] epochs`. |
| `split` | `key`, `choices`, `single`, `slide` | Dual-mode control for `LEARNING_RATE` / `ADAPTIVE_LR`: renders `Single LR` vs `Adaptive Min / Max LR` side-by-side in a single 2-column row (eliminating upstream's 500x180 px empty void). |
| `folder` / `path` | `key`, `label`, `start`, `upload` | Monospace path input + `Browse…` modal trigger (`/api/browse`) + `Clear` button. |
| `text` | `key`, `label`, `lines` | Auto-sizing `textarea` (`SAMPLE_PROMPT` renders as a structured numbered prompt list with per-line drag/delete or raw text toggle). |
| `blocks` | `key`, `groups`, `areas` | Compact visual block-chip selector with category quick-toggles. |
| `note` / `shown` | `key`, `hint` | Rendered inside the section's info popover or as a compact 1-line subtle banner when dynamically populated by `/api/form/state`. |

---

## 4. Workspace 3: Datasets (`/datasets`) — Browser, Prep, Masks & Captions

Consolidates `1. Start` (upload/datasets), `2. Image Prep`, and `3. Captions` into a unified **Master-Detail Dataset Studio**:

- **Left Rail (`240px`):** Searchable list of `/datasets/*` folders showing image count, caption coverage percentage badge (`273/273 · 100%`), trigger word, and `Upload / New Folder` button.
- **Top Sub-Nav Tabs:**
  1. **Captions & Grid (Default):**
     - **Top Toolbar:** Trigger word input + live **Tokenizer Check pill** (`/api/captions/trigger_check` -> shows exact token split & single-token verdict), **Bulk Find / Replace / Prepend** bar with inline diff preview count, and **AI Captioner drawer** (`Qwen3-VL` / `Florence-2` task selector, custom instruction editor, `Caption All`, `Unload Model`).
     - **Main View:** Virtualized responsive grid (or side-by-side Image + Caption table) where each card shows the image thumbnail, resolution & aspect bucket badge (`1216x1216 · 1.5 MP`), paired `.txt` textarea with auto-save on blur (`/api/captions/save`) and `Ctrl+S`, and 1-click soft move to `removed/` (`/api/captions/remove`).
  2. **Image Prep & Look Filter:**
     - Clean 2-column view: Left column configures resize mode (`Resize + face close-ups`, `Resize only`, `Face close-ups only`, `Detail crops`), target megapixels, face padding, and `Look Filter` face outlier scanner (`/api/look/scan`). Right column shows the live `/api/prep/summary` ("What will happen") preview and face detection test canvas (`/api/prep/test`).
  3. **SAM 3.1 Mask Studio:**
     - Interactive canvas for `/api/masks/edit/*` and `/api/masks/make`: click-to-segment via SAM 3.1 (`/api/masks/edit/sam_click`), brush/erase mask weight overlay (`--pic-mask`), and batch auto-masking across the folder.

---

## 5. Workspace 4: Workbench (`/workbench`) — Post-Training Lab

Consolidates `LoRA Royale`, `Studio`, `Profiler`, `Extract`, `RefMod Toolkit`, and `Metadata` under a top sub-navigation bar:

### 5.1 Block Studio (Solving the 769-Input DOM Problem)
Instead of mounting 769 raw form elements in a scrolling vertical list:
- **Left Pane (Setup & Vector Editor):**
  - Compact model + Primary LoRA + optional Donor LoRA selector.
  - **5 Category Master Sliders** (`Style+Comp`, `Style/ID`, `Identity`, `ID/Detail`, `Details`) color-coded with `--color-block-*`.
  - **Interactive SVG/Canvas Block Equalizer Bar:** Displays all `N` transformer blocks (`0..37+`) as vertical interactive bars (like a parametric audio EQ) colored by block category. Users can drag across multiple blocks to sculpt weights, click a single bar for exact numeric entry, or apply 1-click repair presets (`Lucky zones`, `Identity only`, `Fix overbaked details`).
- **Right Pane (Sticky Live A/B Viewport):**
  - Always remains in view (`100%` height of the pane) showing `Baseline` vs `Tweaked` render, live SSIM/LPIPS/Likeness metric badges (`/api/studio/metrics`), and `Save Repaired LoRA`.

### 5.2 LoRA Royale (Epoch Crossfader & Travel)
- **Top Bar:** Checkpoint folder picker (auto-populated with recent runs), prompt, seed, render size, and `Render Epochs` button.
- **Main Stage:** Large central comparison viewport with a smooth 60fps **Crossfade Scrubber** across all rendered epochs, backed by a filmstrip of epoch thumbnails scored by face likeness (`★ Best match` highlighted in `#4ade80`), plus sub-tabs for `Seed Travel`, `Strength Travel`, `Prompt Travel`, and `Comparison Sheet`.

### 5.3 Profiler, Extract, RefMod & Safetensors Metadata
- **Profiler:** Runs `/api/profile/run` and renders the per-block activity & saturation breakdown natively in dark theme alongside the HTML report export.
- **Extract:** Clean 2-card utility for Fine-tune-to-LoRA extraction (`/api/extract/finetune`) and LoRA rank pruning (`/api/extract/run`).
- **Metadata Inspector:** Drag-and-drop or pick any `.safetensors` file (`/api/metadata`) to inspect tensor keys/dtypes, training parameters, and edit `ModelSpec` header tags + thumbnail (`/api/metadata/save`).

---

## 6. Workspace 5: System (`/system`) — Manifest Bundles, Hardware & Preferences

Replaces the 23-card, 3,435 px `Preferences` tab and `Helpers` tab:
- **Tab 1: Model Bundles (`fizgig_local` Integration):**
  - Displays the active and available bundles from `/etc/fizgig/models.json` (`krea2`, `anima`, `sdxl`, `fibo2`, `klein`, `moss_image`, `qwen_image21`, `zimage`, `minimax`), showing resolved component paths, file sizes, safetensors dtype verification badges, and a 1-click **Validate Bundle** button (`/api/local/bundles`).
  - Advanced collapsible table for raw `/api/prefs` model path overrides if needed for experimental testing.
- **Tab 2: Runtime, GPU & Storage:**
  - CUDA device selector (`cuda_device`), default directories (`/datasets`, `/workspace/output_loras`, `/workspace/cache`), and secondary captioner status.
- **Tab 3: Appearance & Session:**
  - UI Density toggle (`Standard 15px` vs `Compact 13.5px`), session logout (`Log out` / `Log out everywhere`), and LAN Helper worker status (`/api/helpers`).
