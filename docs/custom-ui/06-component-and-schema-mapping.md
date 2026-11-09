# 06 — Field-by-Field Schema Mapping & Curated Layout Rules

## 1. Why Upstream's Raw Section Order Must Be Re-Grouped

In upstream Fizgig (`fizgig/families/form.py`), core training parameters are scattered across arbitrary sections:
- `BATCH_SIZE`, `LR_SCHEDULER`, and `LR_WARMUP_STEPS` are buried inside a collapsed **`Other Options`** accordion alongside `METADATA_LICENSE` and `DATASET_CAPTION_EXT`.
- `OPTIMIZER_TYPE`, `OPTIMIZER_ARGS`, `GRADIENT_ACCUMULATION`, and `MAX_GRAD_NORM` are hidden inside a collapsed **`Optimizer`** accordion, separated from `LEARNING_RATE` and `ADAPTIVE_LR` (which live in `params`).
- `__SAMPLE_LIVE` (`Change the previews of the run going now`) is embedded directly inside the `samples` schema section as a pseudo-field (`kind: "check"`), causing draft edits to mutate the running job.

To fix this without losing automatic compatibility with all 14 model families (and any future families added upstream), `ComposerPage.vue` uses a **Two-Tier Hybrid Schema Mapper**:
1. **Tier 1 — Curated Primary Workbench Cards:** Extracts known high-frequency keys from `schema.form.sections` into logical, multi-column parameter groups (`Data & Output`, `Network & Schedule`, `Optimizer & Learning Rate`, `Resolution & Batching`, `Sample Previews`).
2. **Tier 2 — Dynamic Remainder Drawers:** Any schema row in a family not claimed by Tier 1 (and not in the blocklist of obsolete pseudo-keys like `__SAMPLE_LIVE`, `_when_read`, `_overtrain_tip`) is automatically rendered inside its corresponding collapsible drawer at the bottom of the Composer, with a live summary pill in the drawer header.

---

## 2. Tier 1: Curated Primary Workbench Card Mapping

### Card A: Data, Mode & Output (Column 1)

| Field Key | Upstream Section | Upstream `kind` | Custom UI Widget & Layout |
| --- | --- | --- | --- |
| `FAMILY_KIND` | `params` | `radio` | Top Header Segmented Pill Bar: `Standard LoRA` \| `Slider` \| `Fine-tune` |
| `image_folder` | *(root state)* | *(folder)* | Monospace path input + `/datasets` quick-select combobox + `Browse…` button + live badge (`273 imgs · 273 txt`) |
| `TRAIN_SUBFOLDERS` | `params` | `check` | Compact inline toggle `Include subfolders` right below `image_folder` |
| `LORA_NAME` | `output` | `entry` | Monospace identifier input (`w-full`), validated against `[A-Za-z0-9][A-Za-z0-9_.-]{0,127}` |
| `LORA_OUTPUT_DIR` | `output` | `folder` | Monospace path input with placeholder `/workspace/output_loras` + `Reset` button |
| `CAPTION_TRIGGER_WORD` | `params` | `entry` | Input + inline live **Tokenizer Check** badge (`POST /api/captions/trigger_check` -> `✓ 1 token`) |
| `CONTEXT_LORA_PATH` + `CONTEXT_LORA_STRENGTH` | `params` | `path` + `entry` | Single collapsible 2-column row: `[Context LoRA path...]` + `Strength [1.0]` (`w-20`) |

### Card B: Network, Schedule & Saving (Column 2, Top)

| Field Key | Upstream Section | Upstream `kind` | Custom UI Widget & Grid Span |
| --- | --- | --- | --- |
| `NETWORK_TYPE` | `params` | `choice` | 2-col span: `LoRA (standard)` \| `LoKR` segmented pill or `select-sm` |
| `NETWORK_DIM` | `params` | `entry` | 1-col (`w-num-sm`): Rank input + quick pills (`8` `16` `32` `64`) |
| `NETWORK_ALPHA` | `params` | `entry` | 1-col (`w-num-sm`): Alpha input + `= Dim` lock toggle |
| `LOKR_FACTOR` | `params` | `entry` | 1-col (`w-num-sm`): Shown only when `NETWORK_TYPE` is `LoKR` |
| `MAX_TRAIN_EPOCHS` | `params` | `entry` | 1-col (`w-num-sm`): `Epochs` numeric input |
| `SEED` | `params` | `entry` | 1-col (`w-num-sm`): `Seed` numeric input |
| `FAMILY_EMA` | `params` | `choice` | 1-col (`w-num-md`): `EMA` selector (`Off`, `0.95`, `0.98`, `0.99`) |
| `SAVE_EVERY_N_EPOCHS` | `params` | `cadence` | Full-row compact cadence control: `Save every [1] ep` + toggle `after ep [10] every [1] ep` |

### Card C: Learning Rate & Optimizer (Column 2, Middle — Unified!)

Pulls together the split LR controls from `params`, `optimizer`, and `other` into one cohesive card with zero empty voids:

| Field Key | Upstream Section | Upstream `kind` | Custom UI Widget & Grid Span |
| --- | --- | --- | --- |
| `ADAPTIVE_LR` | `params` | `check` | Card Header Toggle: `Single LR` vs `Adaptive LR (Auto-adjust)` |
| `LEARNING_RATE` | `params` | `entry` | Shown when `ADAPTIVE_LR === false`: `Learning Rate` (`w-num-md`, mono) |
| `ADAPTIVE_LR_MIN` + `ADAPTIVE_LR_MAX` | `params` | `choice` | Shown side-by-side when `ADAPTIVE_LR === true`: `Min LR [1e-4]` + `Max LR [4e-4]` + inline dataset-size recommendation pill (`Apply 1e-4 / 2e-4`) |
| `OPTIMIZER_TYPE` | `optimizer` | `choice` | 1-col (`w-select-md`): `muon`, `adamw8bit`, `prodigy`, `automagic`, etc. |
| `LR_SCHEDULER` | `other` | `choice` | 1-col (`w-select-md`): `constant`, `cosine`, `rex`, etc. |
| `LR_WARMUP_STEPS` | `other` | `entry` | 1-col (`w-num-sm`): `Warmup Steps` |
| `GRADIENT_ACCUMULATION` | `optimizer` | `entry` | 1-col (`w-num-sm`): `Grad Accum` |
| `MAX_GRAD_NORM` | `optimizer` | `entry` | 1-col (`w-num-sm`): `Max Grad Norm` |
| `OPTIMIZER_ARGS` | `optimizer` | `entry` | Full-row monospace input (`text-xs`) for extra optimizer key=value args |

### Card D: Resolution, Batching & Smart Automation (Column 2, Bottom)

Pulls `BATCH_SIZE` and bucketing out of `other` to sit right next to `DATASET_MEGAPIXELS` and the live VRAM planner note:

| Field Key | Upstream Section | Upstream `kind` | Custom UI Widget & Grid Span |
| --- | --- | --- | --- |
| `DATASET_MEGAPIXELS` | `params` | `combo` | 1-col (`w-num-md`): Target area (`0.25`, `0.5`, `1.0`, `1.5`, `2.0 MP`) |
| `BATCH_SIZE` | `other` | `choice` | 1-col (`w-num-sm`): `Batch Size` (`Auto`, `1`, `2`, `4`, `8`) + live VRAM estimate pill from `formState.notes.BATCH_SIZE` |
| `STAGE_MP` + `STAGE_UNTIL` | `params` | `choice` | 1-col: Progressive resolution staging (`Off` or `0.5 MP for first 30%`) |
| `ENABLE_BUCKET` + `BUCKET_NO_UPSCALE` | `other` | `check` | Compact inline checkboxes (`Aspect Buckets`, `No Upscale`) |
| `KREA2_LOSS_WATCH` / `*_LOSS_WATCH` | `params` | `check` | Compact toggle chip: `Per-Image Loss Watch` |
| `KREA2_PER_IMAGE_LR` / `*_PER_IMAGE_LR` | `params` | `check` | Compact toggle chip: `Per-Image Adaptive LR` |
| `KREA2_WARMUP_LOOK` / `*_WARMUP_LOOK` | `params` | `check` | Compact toggle chip: `Warmup Look Outliers` |
| `KREA2_AUTO_RECAPTION` + `RECAPTION_*` | `params` | `check` + `choice` | Compact toggle chip: `Auto-Recaption Stuck Images` (expands 1st/2nd pass selectors only when checked) |

### Card E: Sample Previews & Preflight (Column 3)

| Field Key | Upstream Section | Upstream `kind` | Custom UI Widget & Layout |
| --- | --- | --- | --- |
| `SAMPLE_ENABLED` | `samples` | `check` | Card Header Toggle: `Enable Previews During Training` |
| `SAMPLE_AT_FIRST` | `samples` | `check` | Compact pill toggle: `Baseline Epoch 0 Preview` |
| `SAMPLE_EVERY_N_EPOCHS` | `samples` | `cadence` | Compact cadence bar: `Every [1] ep` + optional second stage |
| `SAMPLE_WIDTH` + `SAMPLE_HEIGHT` | `samples` | `choice` | 2-col inline: `[1024] × [1024]` + `1:1` / `3:4` / `4:3` quick ratio pills |
| `SAMPLE_STEPS` + `SAMPLE_CFG_SCALE` + `SAMPLE_SEED` | `samples` + `samples_adv` | `entry` | 3-col compact row: `Steps [8]`, `CFG [1.0]`, `Seed [1234]` |
| `FAMILY_TURBO_STRENGTH` | `samples` | `entry` | Compact slider/input `Turbo Preview LoRA [0.7]` (with `0 = Full steps` badge) |
| `SAMPLE_PROMPT` | `samples` | `text` | Structured numbered prompt list editor (`Prompt 1`, `Prompt 2`, `+ Add`) + Prompt Set load/save bar (`/api/prompt_sets`) |
| `SAMPLE_NEGATIVE` | `samples_adv` | `text` | Collapsible 2-line monospace drawer (collapsed by default since standard default negative is prefilled) |
| `SAMPLE_REFERENCE` | `samples` | `path` | Optional reference image picker (shown when supported by family) |

---

## 3. Tier 2: Collapsible Bottom Drawers & Conditional Mode Panels

1. **Conditional Mode Panels (Shown in Column 1/2 only when `FAMILY_KIND` switches):**
   - When `FAMILY_KIND === "Slider (a dial between two looks)"`: swaps the standard dataset/network card for the **`slider`** section (`FAMILY_SLIDER_SOURCE`, `FAMILY_SLIDER_DIR`, `FAMILY_SLIDER_POS`, `FAMILY_SLIDER_NEG`, `FAMILY_SLIDER_GUIDANCE`, `FAMILY_SLIDER_ANCHORS`, `FAMILY_SLIDER_ULTRA`).
   - When `FAMILY_KIND === "Fine-tune the whole model"`: swaps in the **`finetune`** section (`FAMILY_FT_ROTATIONS`, `FAMILY_FT_SAVE_EVERY`, `FAMILY_FT_MAX_PARTS`, `FAMILY_FT_FUSED`, `FAMILY_FT_REG_DIR`, `FAMILY_FT_REG_MULT`) with live `ft_plan` note badge.
2. **Collapsible Advanced Drawers (Always 1-click accessible at bottom of Composer):**
   - **Drawer 1 — Memory, Precision & State Saving (`memory` + `ENABLE_CACHE`):**
     - Live summary badge in header: `Precision: Auto · Block Swap: Auto · Compile: Auto · Cache: On · Keep 2 states`
     - Contains: `FAMILY_PRECISION`, `BLOCKS_SWAP`, `COMPILE_BLOCKS`, `ENABLE_CACHE`, `SAVE_STATE`, `SAVE_STATE_ON_TRAIN_END`, `KEEP_LAST_N_STATES`, `RESUME_TRAINING`.
   - **Drawer 2 — Masked Training & Caption Dropout (`masks` + `CAPTION_DROPOUT` + `DATASET_CAPTION_EXT`):**
     - Live summary badge: `Masked: Off · Dropout: Off · Ext: .txt`
     - Contains: `MASKED_TRAINING`, `MASK_FLOOR`, `MASK_PRIOR`, `CAPTION_DROPOUT`, `DATASET_CAPTION_EXT`.
   - **Drawer 3 — Multi-Subject & DOP Isolation (`subjects`):**
     - Live summary badge: `1 subject · Normal LoRA`
     - Contains: `FAMILY_SUBJECTS`, `FAMILY_PEOPLE_MODE`, `FAMILY_CONCEPT_DIR*`, `FAMILY_DOP_TRIGGER*`, `FAMILY_DOP_CLASS*`, and dynamic `_subject*_as` preview notes from `/api/form/state`.
   - **Drawer 4 — Embedded Safetensors Metadata (`METADATA_*` from `other`):**
     - Live summary badge: `Title / Author / Tags / Thumbnail (Optional)`
     - Contains: `METADATA_TITLE`, `METADATA_AUTHOR`, `METADATA_DESCRIPTION`, `METADATA_LICENSE`, `METADATA_TAGS`, `METADATA_TRIGGER_PHRASE`, `METADATA_THUMBNAIL`.
   - **Drawer 5 — Family-Specific Extensions (Auto-Fallback):**
     - Any key present in `schema.form.sections` not listed above is automatically rendered here using `SchemaField.vue` according to its `row.kind`, guaranteeing forward compatibility with new upstream models (e.g., `acestep15xl` audio controls, `vimoo` video controls, `minimax_refmod`).

---

## 4. Suppressed Upstream Pseudo-Keys (Never Rendered as Form Inputs)

The following keys in upstream `/api/schema` exist only for upstream's imperative layout hacks or dangerous side-effects and are explicitly filtered out by `useSchemaStore`:
- `__SAMPLE_LIVE` — Replaced by the explicit `LivePreviewDrawer.vue` inside the **Cockpit** workspace so draft edits can never overwrite `/workspace/output_loras/.sample_override.json`.
- `_when_read`, `_overtrain_tip`, `_slider_help_pairs`, `_slider_help_prompts`, `_ft_to_lora`, `_subjects_intro` — Static tutorial prose rows (`kind: "note"`). Moved into contextual `?` help popovers on their respective section headers.
