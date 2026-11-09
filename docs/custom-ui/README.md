# Fizgig Custom UI Specification (`fizgig-ui`)

This directory contains the engineering, UX/UI, visual design, and API architecture specifications for replacing Fizgig's upstream Tkinter-ported web page with a modern, high-density, power-user web interface built on the **VoidZero Vite+ / Vue 3.5 / TypeScript 7.x / Tailwind CSS 4 / DaisyUI 5** stack.

## Design Goals

1. **Zero Feature Loss, Radical Hierarchy Gain:** Expose 100% of Fizgig's capabilities (all 14 model families, dynamic schema planner, live loss/residual telemetry, per-image loss watch, dataset prep, SAM 3.1 masking, AI captioning, Studio block repair, LoRA Royale epoch crossfading, Profiler, Extraction, and `fizgig_local` manifest bundles) without the 4,368 px scrolling walls of prose and 769-input DOM explosions.
2. **Strict Separation of Live Run vs. Draft State:** Eliminate upstream's shared global form state (`S.values`) and default-on live sample override (`__SAMPLE_LIVE` -> `.sample_override.json`), making it impossible for draft preset browsing to clobber an active training run.
3. **Dark Linear-Style Developer Product Aesthetic:** Adopt the carbon-dark elevation palette (`#08090a` / `#0b0c0e` / `#0c0d0f` / `#111318`), `1px` hairline borders (`rgba(255, 255, 255, 0.07)`), zero drop shadows (`--depth: 0`), `Inter Variable` + `JetBrains Mono Variable` (`tabular-nums`), and single rationed indigo accent (`#5e6ad2`).
4. **Zero-Disruption Host Development & Container Packaging:** Develop and run the UI on the host against the live container (`127.0.0.1:8082`) without restarting or interrupting active multi-hour GPU training jobs, then bake the compiled static assets into the container image alongside `fizgig_mcp`.

---

## Specification Index

| Document | Scope |
| --- | --- |
| [01-current-state-audit.md](01-current-state-audit.md) | Quantitative DOM/CSS audit of upstream Fizgig (`index.html`, `app.js`, `style.css`, `server.py`), root-cause analysis of its 8 major UX failure modes, and tab-by-tab functional inventory. |
| [02-design-system-and-colorway.md](02-design-system-and-colorway.md) | Visual design language, carbon-dark elevation tokens, semantic status hues, ML telemetry & block-category colorways, typography scale, density rules, and complete DaisyUI 5 + Tailwind CSS 4 theme configuration. |
| [03-layout-and-workspaces.md](03-layout-and-workspaces.md) | App shell geometry (72 px icon rail + persistent telemetry top bar), consolidating 14 flat tabs into 5 structured workspaces (`Cockpit`, `Composer`, `Datasets`, `Workbench`, `System`), and detailed component layouts. |
| [04-tech-stack-and-toolchain.md](04-tech-stack-and-toolchain.md) | VoidZero Vite+ (`vp`), Rolldown, Oxlint (`oxlint-tsgolint`), Oxfmt, TypeScript 7.x (`tsgo` / `vue-tsc`), Vue 3.5, Pinia 4, Reka UI, DaisyUI 5, directory layout, config files, and state architecture. |
| [05-backend-shim-and-api-contract.md](05-backend-shim-and-api-contract.md) | Complete reference of upstream Fizgig's ~110 `/api/*` endpoints, `X-Fizgig-Token` authentication shim, `fizgig_local` manifest catalog endpoints, zero-disruption host proxy setup, and Docker build integration. |
| [06-component-and-schema-mapping.md](06-component-and-schema-mapping.md) | Field-by-field mapping of Fizgig's 15 schema sections and 13 row `kind`s into high-density curated cards, collapsible drawers, and suppressed upstream pseudo-keys (`__SAMPLE_LIVE`). |

---

## Implementation Phases

1. **Phase 1 — Scaffold & BFF Proxy (Host-Side, Non-Disruptive):**
   - Initialize `ui/` in `/srv/project/github/fizgig-docker/ui` with Vite+ (`vp`), Vue 3.5, TypeScript 7.x, Tailwind CSS 4, and DaisyUI 5.
   - Stand up the lightweight BFF/proxy route (handling `X-Fizgig-Token` login automatically against `http://127.0.0.1:8082` using `/srv/appdata/secret/fizgig_password`).
2. **Phase 2 — Core Training Loop (`Cockpit` + `Composer`):**
   - Build the App Shell, persistent GPU/Run header bar, **Cockpit** (live KPI strip, interactive step/epoch/per-image loss chart, live log viewer, `Epoch x Prompt` sample matrix, explicit live-preview override drawer, and queue/history manager), and **Composer** (isolated draft store, 3-column curated grid + hybrid schema renderer for all 13 upstream row `kind`s, preset diff badges, and `/api/plan` preflight drawer).
3. **Phase 3 — Data & Post-Training (`Datasets` + `Workbench` + `System`):**
   - Build the **Datasets** master-detail workspace (dataset browser, Image Prep, SAM 3.1 mask editor, and Caption Studio with tokenizer check and bulk find/replace), **Workbench** (LoRA Royale crossfader/travel, virtualized Block Studio, Profiler, Extract, RefMod, Metadata), and **System** (`fizgig_local` bundle manager & preferences).
4. **Phase 4 — Container Integration:**
   - Mount the compiled `ui/dist` bundle and `/api/local/*` routes into the container's companion Starlette server and add automated smoke/unit tests.
