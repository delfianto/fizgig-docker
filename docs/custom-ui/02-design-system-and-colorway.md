# 02 — Design System, Colorway & DaisyUI 5 Theme Specification

## 1. Aesthetic Philosophy & Style Anchor

The Fizgig Custom UI adopts the **Dark Linear-Style Developer Product UI** design language established in `OrangeLoaf`:

- **Calm, High-Density Precision:** ML model training is an hours-long engineering workflow where users compare numerical telemetry (step loss, EMA loss, gradient norms, VRAM headroom) alongside visual artifacts (epoch-by-epoch sample matrices, face crops, attention masks, and per-block LoRA weights). The interface must behave like a precision instrument—never a chatty wizard or a sprawling desktop settings dump.
- **Hierarchy from Typography & Surface Elevation, Not Decoration:** Surfaces are flat (`--depth: 0`, `--noise: 0`) and separated exclusively by four near-black elevation steps and `1px` hairline borders (`rgba(255, 255, 255, 0.07)`). Drop shadows are banned everywhere in the base layout and permitted only on floating overlays (modals, command palettes, hover popovers, lightboxes).
- **Single Rationed Primary Accent:** Indigo (`#5e6ad2`) is reserved strictly for the single primary call-to-action per view (`Start Training`, `Add to Queue`, `Render Epochs`), active navigation indicator, keyboard focus rings, and active progress fills. Secondary buttons and structural chrome remain desaturated neutral slate so nothing competes visually with live telemetry or sample imagery.
- **Zero-Prose Default Flow:** Conversational multi-sentence explanations are removed from the vertical layout flow. Controls use concise labels, inline unit suffixes (`epochs`, `MP`, `s/it`, `GB`), and subtle `?` hover popovers (or an optional `Explain Mode` inspector drawer) for upstream `hint` text.

---

## 2. Colorway & Token Specification

### 2.1 Surface Elevation Hierarchy (Carbon Near-Black)

| Token / CSS Variable | Hex / Value | Usage |
| --- | --- | --- |
| `--color-base-100` (`bg-base-100`) | `#08090a` | Root application background, inset code/log wells, image letterbox backing |
| `--color-canvas` | `#0b0c0e` | Primary workspace scroll canvas |
| `--color-base-200` (`bg-base-200`) | `#0c0d0f` | Left 72 px icon rail, top telemetry bar, collapsible drawer headers, table headers |
| `--color-base-300` (`bg-base-300`) | `#111318` | Raised cards, parameter group panels, input backgrounds, modal surfaces |
| `--color-surface-hover` | `#161922` | Interactive row hover, active table row, segmented pill hover |
| `--color-hairline` | `rgba(255, 255, 255, 0.07)` | All `1px` structural borders, card outlines, grid cell dividers |
| `--color-hairline-strong` | `rgba(255, 255, 255, 0.14)` | Focused/hovered input borders, active card rings |

### 2.2 Typography & Content Colors

All text pairings meet or exceed WCAG AA contrast (`4.5:1` for body text, `3.0:1` for muted metadata) against `#08090a`–`#111318`:

| Token / Role | Hex | Contrast vs `#0b0c0e` | Usage |
| --- | --- | --- | --- |
| `--color-base-content` (Primary) | `#f4f5f8` | `17.8:1` | Section headings, active control values, primary labels, KPI numbers |
| `--color-neutral-content` (Secondary) | `#b9bdc6` | `10.4:1` | Standard field labels, inactive tab labels, table cell text, caption prose |
| `--color-muted` (Muted / Meta) | `#7d828c` | `5.1:1` | Parameter keys, unit suffixes (`epochs`, `MP`), timestamps, file sizes, hints |
| `--color-primary-content` | `#ffffff` | `4.70:1` (vs `#5e6ad2`) | Pure white text on solid `#5e6ad2` primary buttons (clears 4.5:1 AA even at 11–12 px bold) |

### 2.3 Brand & Semantic Status Palette

Semantic colors are confined to **status rings, pill badges, sparklines, and icon tints**—never full-card background fills:

| Semantic State | Token | Foreground Hex | Subtle Badge Fill (`12%` alpha) | Usage |
| --- | --- | --- | --- | --- |
| **Primary / Active / Paused** | `--color-primary` | `#5e6ad2` | `rgba(94, 106, 210, 0.14)` | Primary CTA button, active nav icon, paused badge outline, modified-from-preset dot |
| **Running / Training / Prep** | `--color-warning` | `#f2c94c` | `rgba(242, 201, 76, 0.12)` | Active training pulse ring, live step progress bar, warm-up / outlier warning pills |
| **Completed / Optimal / Ready** | `--color-success` | `#4ade80` | `rgba(74, 222, 128, 0.12)` | Completed run check, lowest-loss epoch marker, valid tokenizer trigger check |
| **Failed / Danger / Stop** | `--color-error` | `#eb5757` | `rgba(235, 87, 87, 0.12)` | Stop training button (hover/confirm), preflight error blocker, OOM / failed run badge |
| **Queued / Idle / Neutral** | `--color-secondary` | `#7d828c` | `rgba(125, 130, 140, 0.12)` | Queued job dashed ring, unloaded model state, default preset badge |

### 2.4 ML Telemetry & Block-Weight Visualization Palette

Fizgig includes specialized charts (Loss vs. Step, Per-Image Residual Heatmap, Profiler Block Activity, Studio Block Sliders). These use a dedicated, colorblind-distinguishable data palette:

| Data Series / Category | Token | Hex | Visual Role |
| --- | --- | --- | --- |
| **Raw Step Loss** | `--chart-loss-raw` | `rgba(125, 130, 140, 0.32)` | Background 1px hairlines showing raw noisy step-by-step loss |
| **Smoothed / EMA Loss** | `--chart-loss-smooth` | `#5e6ad2` | Primary `2px` smooth loss curve |
| **Epoch Average Loss** | `--chart-loss-epoch` | `#38bdf8` | Step-function or connected dots across epoch boundaries |
| **Learning Rate Curve** | `--chart-lr` | `#f2c94c` | Dashed `1.5px` secondary-axis line for LR schedule / Adaptive LR bounds |
| **Lowest Loss Marker** | `--chart-best` | `#4ade80` | Highlighted node on the loss curve + gold/green badge on the matching checkpoint |
| **Block Cat 1: Style + Comp** | `--block-style-comp` | `#5b9bd5` | Early transformer blocks (broad composition & global style) |
| **Block Cat 2: Style / ID** | `--block-style-id` | `#5bb3a6` | Early-mid transition blocks |
| **Block Cat 3: Identity** | `--block-identity` | `#4ade80` | Core subject likeness / structure blocks (`identity_blocks`) |
| **Block Cat 4: ID / Detail** | `--block-id-detail` | `#f2c94c` | Late-mid anatomy / expression blocks |
| **Block Cat 5: Fine Details** | `--block-detail` | `#f2994a` | Late blocks (`detail_blocks`: skin texture, hair strands, fabric micro-detail) |

---

## 3. Typography & Numeric Discipline

### 3.1 Font Stack
- **UI Typeface (`--font-sans`):** `"Inter Variable", ui-sans-serif, system-ui, sans-serif` (`@fontsource-variable/inter`)
  - Used for all navigation, headings, form labels, buttons, and tooltips.
- **Technical / Telemetry Typeface (`--font-mono`):** `"JetBrains Mono Variable", ui-monospace, monospace` (`@fontsource-variable/jetbrains-mono`)
  - Mandatory for: numeric inputs, loss values (`0.0441`), learning rates (`1.00e-04`), step counters (`962 / 8190`), speed (`5.98 s/it`), ETA timers (`12:00:40`), GPU VRAM/RAM counters (`14.0 / 16.0 GB`), file paths (`/datasets/jeje_v1`), optimizer args, and console log output.
  - Always paired with `font-variant-numeric: tabular-nums` (`tabular-nums` in Tailwind) so live-updating numbers never cause horizontal layout jitter during 2-second polling.

### 3.2 Type Scale (Strict Floor of `12px`)

| Element | Size | Weight | Font | Tracking / Line Height |
| --- | --- | --- | --- | --- |
| Workspace Title | `16px` (`text-base`) | `600` (`font-semibold`) | `Inter` | `-0.01em` / `1.25` |
| Card / Section Header | `13px` (`text-[13px]`) | `600` (`font-semibold`) | `Inter` | `0` / `1.3` |
| Group Subheader (Overline) | `11px` (`text-[11px]`) | `600` (`font-semibold`) | `Inter` | `0.06em` (`uppercase`) / `1.2` |
| Standard Control Label | `13px` (`text-[13px]`) | `500` (`font-medium`) | `Inter` | `0` / `1.35` |
| Text Input / Select Value | `13px` (`text-[13px]`) | `400` (`font-normal`) | `Inter` (prose) / `JetBrains Mono` (numbers & paths) | `0` / `1.35` |
| KPI Metric Value (Cockpit) | `18px` (`text-lg`) | `600` (`font-semibold`) | `JetBrains Mono` (`tabular-nums`) | `-0.02em` / `1.2` |
| Badge / Chip / Hint / Log | `12px` (`text-xs`) | `400`–`500` | `Inter` or `JetBrains Mono` | `0` / `1.4` |

---

## 4. Shape, Density & Control Geometry

### 4.1 Spacing & Density Modes
- **Control Row Height:** `32px` (`h-8` / `btn-sm` / `input-sm` / `select-sm`) for high-density parameter grids; `36px` (`h-9`) for primary header toolbar actions.
- **Card Padding:** `14px 16px` (`p-3.5 px-4`), with `10px`–`12px` (`gap-2.5` to `gap-3`) between grid cells.
- **Border Radius:** `6px` (`0.375rem`) on inputs, buttons, and inner tiles; `8px` (`0.5rem`) on section cards and modals; `4px` (`0.25rem`) on compact badges/tags.
- **Root Density Toggle (`data-density`):**
  - `default`: `:root { font-size: 15px; }`
  - `compact`: `:root[data-density="compact"] { font-size: 13.5px; }` (scales all `rem`-based Tailwind/DaisyUI spacing, row heights, and fonts proportionally for 1440p/4K power users).

### 4.2 Constrained Control Widths (Fixing Upstream's 600 px Inputs)
Every schema field is mapped to a semantic width tier based on its data type:

| Field Tier | Width Rule | Examples |
| --- | --- | --- |
| **Compact Numeric (`w-num-sm`)** | `96px`–`120px` | `NETWORK_DIM` (`8`), `NETWORK_ALPHA` (`8`), `MAX_TRAIN_EPOCHS` (`30`), `BATCH_SIZE` (`1`), `GRADIENT_ACCUMULATION` (`1`), `SEED` (`42`), `SAMPLE_STEPS` (`8`), `SAMPLE_CFG_SCALE` (`1.0`) |
| **Medium Scientific / Float (`w-num-md`)** | `140px`–`160px` | `LEARNING_RATE` (`1e-4`), `ADAPTIVE_LR_MIN` (`1e-4`), `ADAPTIVE_LR_MAX` (`4e-4`), `DATASET_MEGAPIXELS` (`1.5`), `FAMILY_EMA` (`0.98`) |
| **Standard Selector (`w-select-md`)** | `200px`–`260px` | `OPTIMIZER_TYPE`, `LR_SCHEDULER`, `NETWORK_TYPE`, `FAMILY_PRECISION`, `BLOCKS_SWAP` |
| **Path / Identifier (`w-path-full`)** | `flex-1 min-w-[240px]` | `LORA_NAME`, `LORA_OUTPUT_DIR`, `image_folder`, `CONTEXT_LORA_PATH`, `OPTIMIZER_ARGS` |

### 4.3 Preset-Diff & Live-Note Affordances
- **Preset-Diff Dot:** When a parameter's value in the Composer differs from the currently selected preset's baseline, a `6px` indigo dot (`#5e6ad2`) appears next to its label. Clicking the dot resets that single field to the preset default.
- **Dynamic Planner Badges:** Upstream `/api/form/state` returns dynamic notes (e.g., VRAM batch planner `14.1 GB estimated`, multi-person folder counts, or learning-rate recommendations for large datasets). Instead of inserting giant shifting yellow boxes into the grid, these render as compact inline status pills next to the section header, with full details + 1-click "Apply suggestion" action inside a non-shifting popover or footer bar.

---

## 5. Complete Tailwind CSS v4 + DaisyUI 5 Theme File (`src/app.css`)

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: false;
}

@plugin "daisyui/theme" {
  name: "fizgig";
  default: true;
  prefersdark: true;
  color-scheme: dark;

  /* 4-step near-black elevation hierarchy */
  --color-base-100: #08090a;
  --color-base-200: #0c0d0f;
  --color-base-300: #111318;
  --color-base-content: #f4f5f8;

  /* Single rationed accent (Linear indigo, 4.70:1 contrast with #ffffff) */
  --color-primary: #5e6ad2;
  --color-primary-content: #ffffff;

  /* Desaturated secondary/neutral chrome */
  --color-secondary: #7d828c;
  --color-secondary-content: #08090a;
  --color-accent: #5e6ad2;
  --color-accent-content: #f4f5f8;
  --color-neutral: #111318;
  --color-neutral-content: #b9bdc6;

  /* Semantic status hues (confined to pills, rings, icons, sparklines) */
  --color-info: #38bdf8;
  --color-info-content: #08090a;
  --color-success: #4ade80;
  --color-success-content: #08090a;
  --color-warning: #f2c94c;
  --color-warning-content: #08090a;
  --color-error: #eb5757;
  --color-error-content: #f4f5f8;

  /* Tight developer-tool geometry, zero drop-shadows or noise */
  --radius-selector: 0.375rem;
  --radius-field: 0.375rem;
  --radius-box: 0.5rem;
  --size-selector: 0.22rem;
  --size-field: 0.22rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}

@import "@fontsource-variable/inter";
@import "@fontsource-variable/jetbrains-mono";

@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  --color-canvas: #0b0c0e;
  --color-surface-hover: #161922;
  --color-muted: #7d828c;
  --color-hairline: rgba(255, 255, 255, 0.07);
  --color-hairline-strong: rgba(255, 255, 255, 0.14);

  /* Telemetry & Block Category Tokens */
  --color-chart-raw: rgba(125, 130, 140, 0.32);
  --color-chart-smooth: #5e6ad2;
  --color-chart-epoch: #38bdf8;
  --color-chart-lr: #f2c94c;
  --color-chart-best: #4ade80;

  --color-block-style-comp: #5b9bd5;
  --color-block-style-id: #5bb3a6;
  --color-block-identity: #4ade80;
  --color-block-id-detail: #f2c94c;
  --color-block-detail: #f2994a;
}

:root {
  font-size: 15px;
}

:root[data-density="compact"] {
  font-size: 13.5px;
}

body {
  background-color: var(--color-base-100);
  color: var(--color-base-content);
  font-family: var(--font-sans);
  overflow: hidden;
  height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.font-mono-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```
