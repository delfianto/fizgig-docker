# 01 — Current State Audit: Why Upstream Fizgig's UI Fails

This document records the empirical findings from inspecting the live upstream Fizgig web interface (`/opt/Fizgig/src/fizgig/web/`) running inside the `fizgig` container (`http://127.0.0.1:8082`).

---

## 1. Monolithic Codebase & Quantitative DOM Metrics

Upstream Fizgig's web UI is a single-page vanilla DOM application with zero component modularity or state isolation:

| Upstream File | Line Count | Role |
| --- | --- | --- |
| `/opt/Fizgig/src/fizgig/web/server.py` | 5,082 lines | Single `ThreadingHTTPServer` handling ~110 `GET`/`POST` routes, subprocess management, file I/O, and state persistence. |
| `/opt/Fizgig/src/fizgig/web/static/index.html` | 2,046 lines | Hardcoded HTML skeleton for 14 top-level `.tab-panel` sections, modal overlays, and sidebar widgets. |
| `/opt/Fizgig/src/fizgig/web/static/app.js` | 9,653 lines | Imperative DOM manipulation (`$()`, `el()`), one global mutable state object `S`, and 2-second polling loops. |
| `/opt/Fizgig/src/fizgig/web/static/style.css` | 2,704 lines | CSS port of Fizgig's desktop Tkinter (`ttk.Notebook` Clam theme) layout rules. |
| **Total** | **19,485 lines** | Monolithic server + imperative client script. |

### Measured DOM & Scroll Footprint by Tab (1600 x 1050 Viewport)

We measured the live rendered DOM inside Chromium (`1600 x 1050` viewport, active Krea 2 run `jeje_krea2_1216`):

| Tab ID | Upstream Label | Scroll Height (`.notebook-pane`) | Cards | Interactive Inputs / Buttons | Field Rows | Inline Prose Hints (`.field-hint`, `.card-desc`) |
| --- | --- | --- | --- | --- | --- | --- |
| `start` | `1. Start` | 1,807 px | 8 | 22 | 5 | 17 |
| `prep` | `2. Image Prep` | 2,843 px | 11 | 63 | 15 | 51 |
| `captions` | `3. Captions` | 3,117 px | 7 | 84 | 34 | 40 |
| `samples` | `4. Samples` | 2,376 px | 4 | 32 | 26 | 30 |
| `training` | `5. Training` | **4,368 px** | **15** | **170** | **190** | **197** |
| `outputs` | `Runs & outputs` | 1,050 px | 3 | 17 | 6 | 8 |
| `profiler` | `Profiler` | 1,050 px | 3 | 15 | 9 | 8 |
| `studio` | `Studio` | 2,859 px | 7 | **769** | 36 | 39 |
| `royale` | `LoRA Royale` | 1,637 px | 10 | 125 | 44 | 71 |
| `prefs` | `Preferences` | **3,435 px** | **23** | **179** | **93** | **168** |

---

## 2. The Eight Core UX/UI Failure Modes

### Failure Mode 1: Literal Port of a Desktop Tkinter (`ttk.Notebook`) Application
`style.css` explicitly documents that the web UI was constructed to mimic a Python Tkinter desktop window:
- `/* Exact Desktop Window Title Bar */` (`.window-titlebar`) renders a fake desktop window bar inside the browser viewport.
- `/* Main Desktop Notebook Layout (Matches ttk.Notebook with padx=10, pady=10) */` wraps the page in nested fixed-overflow boxes.
- Later in Fizgig v8, a vertical sidebar (`.tab-strip-row`) was bolted onto the left of `.notebook-container`, but the internal panels kept their single-column Tkinter card geometry (`margin: 0 36px 16px 36px`), wasting 40-60% of horizontal screen space on wide monitors while forcing 4,300+ px of vertical scrolling.

### Failure Mode 2: Shared Global Mutable State (`S.values`) Conflates "Draft" and "Active Run"
In `app.js`, there is only one active form state object (`S.values`) shared across `1. Start`, `4. Samples`, and `5. Training`:
- When a training job is running, the user has **no separate view** for the running job vs. configuring the next job.
- Worse, on the `4. Samples` tab, the toggle `Change the previews of the run going now` (`__SAMPLE_LIVE`) is **checked ON by default**.
- Whenever `S.values` changes—including when a user selects a built-in preset on `5. Training` to inspect settings or prepare their *next* dataset—`app.js` triggers `sampleLiveSoon()`, which sends `POST /api/run/sample_override` and writes `/workspace/output_loras/.sample_override.json`.
- **Real-world failure observed during audit:** Selecting the `Krea 2 Ultra Fast` preset while `jeje_krea2_1216` was running silently overwrote `.sample_override.json` with `"prompts": ["A high quality photo"]`, hijacking Epoch 3's preview generation.

### Failure Mode 3: Inverted Information Hierarchy on `5. Training`
When a training run is active, the user's primary questions are:
1. *What epoch/step is it on, what is the ETA, and what does the loss curve look like?*
2. *How do the latest sample previews compare against earlier epochs?*
3. *Where are the `Pause`, `Stop`, `Sample now`, and `Save now` buttons?*

In upstream Fizgig, opening `5. Training` shows **none of those** in the first two screenfuls (`0 px` to `2,200 px`). Instead:
- `0 px – 2,200 px`: The static configuration form (`Model`, `Presets`, `Output Directory`, `Kind of training`, `Learning rate`, `Network`, `Length`, `How often to save`, `Context LoRA`, `Picture size`, and 5 collapsed accordion headers).
- `2,250 px – 2,800 px`: Finally, the `Run` card with `Epoch`, `Step`, `Speed`, `Loss`, `Time Left`, and the loss canvas.
- `2,850 px`: The action button strip (`Check settings`, `Start Training`, `Add to queue`, `Pause`, `Sample now`, `Per-image loss`, `Save now`, `Move to...`, `Stop`)—squished into a 9-button horizontal row directly between the loss chart and raw console stdout.
- `2,950 px – 4,368 px`: Raw console log box, duplicated `Run summary` card (repeating `Epoch`, `Speed`, `Loss`, `Time left` a second time!), `Checkpoints` download list, and a link to jump back to `4. Samples` to see previews.

### Failure Mode 4: Novel-Length Inline Prose (`600+` Paragraphs in Layout Flow)
Instead of progressive disclosure (compact labels + tooltips/popovers or an optional help drawer), Fizgig renders multi-sentence conversational tutorials beneath every single input:
- `5. Training` alone injects **197 `.field-hint` / `.card-desc` blocks** directly into the vertical grid flow.
- Many hints dynamically mutate into multi-line yellow warning boxes (`.row-boxed` / `note_*`) that shift layout height while you type.
- The result is an abysmal signal-to-noise ratio: ~80% of the pixels on screen are static gray/yellow tutorial paragraphs, and only ~20% are actual controls or telemetry.

### Failure Mode 5: Broken Grid Geometry & Unconstrained Input Widths
- Numeric fields that hold 1 to 6 characters (`Max Epochs: 30`, `Seed: 42`, `Network Dim: 8`, `Network Alpha: 8`, `CFG Scale: 1.0`, `Width: 1024`) are rendered as 450–700 px wide text boxes.
- Conditional layout rules leave giant visual holes: on `5. Training`, when `Adaptive LR` is enabled for Krea 2, the primary `Learning rate` input is hidden on the left half of the card, leaving a **500 x 180 px empty black rectangle** on the left while `Min LR`, a giant yellow paragraph box, and `Max LR` stack lopsidedly on the right.

### Failure Mode 6: Disconnected Sample Evaluation (`4. Samples` vs. `5. Training` vs. `Runs & outputs`)
- Sample previews are separated from the loss curve and training controls onto a different tab (`4. Samples`), and must be scrolled past 1,000 px of prompt configuration inputs to view (`Previews so far`).
- By default, the gallery renders a flat chronological grid (`Newest first`) where `Prompt 1` and `Prompt 2` are interleaved across rows, making it visually difficult to scan how `Prompt 1` evolved across `Epoch 1 -> Epoch 2 -> Epoch 3 -> Epoch 4` while simultaneously checking the loss curve at those epochs.

### Failure Mode 7: Unvirtualized 769-Control DOM Explosion on `Studio`
- Even before a LoRA is loaded into `Studio`, the tab mounts **769 `<input>`, `<select>`, `<button>`, and `<textarea>` elements** in the DOM (hidden block sliders, preset buttons, donor controls, mix dials).
- Every block of a transformer (`n_blocks` up to 38–60 blocks depending on architecture, multiplied by primary + donor + category masters) is rendered as raw DOM elements inside a single scrolling card.

### Failure Mode 8: Hostile Boot Sequence & Forced Navigation Resets
In `app.js` (`boot()`):
```js
showTab("start"); // Fizgig always opens on Start (its News card), never the last tab used
setTimeout(() => $("bootCover").classList.add("done"), switched ? 0 : Math.max(0, 3500 - performance.now()));
```
1. **Artificial 3.5-second boot delay:** Even when local loopback APIs respond in `< 40 ms`, `boot()` intentionally holds `#bootCover` over the screen for `3,500 ms` on every new tab/window so the user is forced to read a random tip.
2. **Forced redirect to `1. Start`:** Refreshing the browser while monitoring an active training run kicks you out of `5. Training` back to `1. Start` so you are forced to look at the purple `News` release-notes banner at the top of `1. Start`.
3. **Intrusive `Welcome to Fizgig 8` video modal:** Any new browser session or cleared `localStorage` triggers a full-screen video/confetti popup over the workspace.

---

## 3. Tab-by-Tab Functional Inventory (What Must Be Preserved)

To guarantee **100% functional parity** (zero dropped features), every capability across upstream's 14 tabs is cataloged below and mapped to its target home in the new 5-workspace architecture:

| Upstream Tab | Core Capabilities to Preserve | Target Workspace in New UI |
| --- | --- | --- |
| **1. Start** | Model family selector (`14 families`), active training folder path picker (`/api/browse`), dataset quick-picker grid (`/api/datasets`), dataset upload (`/api/upload`, `/api/upload/chunk`), model missing warning check. *(Drop: forced News banner, RunPod affiliate button, Buy Me a Coffee button).* | **Composer** (Model & Dataset selector) + **Datasets** (Upload & Browser) |
| **2. Image Prep** | Resize/PNG conversion + face close-up crops + style detail crops (`/api/prep/options`, `/api/prep/summary`, `/api/prep/run`, `/api/prep/status`), Look Filter outlier face scan (`/api/look/scan`, `/api/look/status`), SAM 3.1 auto-masking & interactive click/brush mask editor (`/api/masks/*`). | **Datasets -> Prep & Masks** sub-view |
| **3. Captions** | Trigger word input + tokenizer check (`/api/captions/trigger_check`), AI captioning with Qwen3-VL / Florence-2 & custom instructions (`/api/captions/options`, `/api/captions/ai`, `/api/captions/status`, `/api/captions/stop`, `/api/captions/unload`), static captioning, bilingual translation, bulk Find/Replace/Add with preview (`/api/captions/replace`, `/api/captions/add`), per-image caption grid + soft remove/restore (`/api/captions`, `/api/captions/save`, `/api/captions/remove`, `/api/captions/restore`). | **Datasets -> Captions** sub-view |
| **4. Samples** | Sample enable toggle, multi-line prompt list editor, saved prompt sets CRUD (`/api/prompt_sets`, `/api/prompt_set/save`, `/api/prompt_set/delete`), Turbo LoRA preview strength, reference image, width/height/steps/seed/CFG/negative prompt, two-stage preview cadence (`Every N epochs`, `then from epoch M every K`), live preview override (`/api/run/sample_override`), and sample gallery with `Prompt x Epoch` matrix, Likeness score (`/api/likeness`), and Style score (`/api/style`). | **Composer** (Sample configuration) + **Cockpit** (Live Sample Matrix & explicit Live Override drawer) |
| **5. Training** | Family selector, built-in & user presets CRUD (`/api/presets`, `/api/preset`, `/api/preset/save`), dynamic schema form (`15 sections`, `13 row kinds`, `/api/form/state`), preflight check (`/api/plan`), start/queue/pause/resume/stop, `Sample now` / `Save now` (`/api/run/now`), live loss chart (log scale, outlier clip, LR overlay, epoch avg, running avg), per-image loss watch modal (`/api/runs/image_loss`, `/api/runs/caption`), live console log (`/api/log`), run summary & saved checkpoints list (`/api/checkpoints`). | **Composer** (Draft config, Presets, Preflight) + **Cockpit** (Live Telemetry, Loss/Residual Charts, Controls, Logs, Checkpoints) |
| **Runs & outputs** | Shared training queue (`hold`, `start`, reorder `/api/queue/move`, edit `/api/queue/item` & `/api/queue/update`, remove `/api/queue/remove`), historical runs list (`/api/runs`) with loss sparklines, notes (`/api/runs/notes`), `Continue` from latest state (`/api/runs/continue`), `Clone settings to Composer` (`/api/runs/settings`), delete run (`/api/runs/delete`), and full output file browser (`/api/outputs`, `/api/download`). | **Cockpit -> Queue & History** sub-views |
| **Profiler** | Block activity & saturation profiler across epochs (`/api/profile/info`, `/api/profile/prefill`, `/api/profile/run`, `/api/profile/status`, `/api/profile/stop`, `/api/profile/report`). | **Workbench -> Profiler** |
| **Studio** | Interactive block-by-block LoRA weight tuning, epoch blending, donor LoRA mixing, live A/B baseline vs. tweaked preview rendering, likeness/metrics comparison, and saving repaired `.safetensors` (`/api/studio/*`). | **Workbench -> Block Studio** |
| **LoRA Royale** | Multi-epoch batch rendering on fixed seeds, interactive crossfade scrubber between consecutive epochs, Seed/Strength/Prompt travel animations, comparison contact sheets, and face likeness scoring (`/api/royale/*`). | **Workbench -> LoRA Royale** |
| **RefMod Toolkit** | MiniMax H3 RefMod graph presets, sweep chips, and media comparison (`/api/refmod/*`). | **Workbench -> RefMod** |
| **Extract** | Extract LoRA from full fine-tune checkpoint diff or resize/prune existing LoRA rank (`/api/extract/*`). | **Workbench -> Extract** |
| **Metadata** | Inspect `.safetensors` header JSON and rewrite ModelSpec metadata + embedded thumbnail without touching tensor bytes (`/api/metadata`, `/api/metadata/save`, `/api/metadata/thumbnail`). | **Workbench -> Metadata** |
| **Preferences / Helpers / Pods** | Local model paths (`fizgig_local` manifest bundles + `/api/prefs`), secondary captioner path, default folders, CUDA GPU selector, password/session management, and LAN/Helper worker management (`/api/helpers/*`). | **System** |
