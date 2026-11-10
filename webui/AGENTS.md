# WebUI Workspace & Agent Guide

This directory contains the high-density Linear-style Web UI for Fizgig, a web-based LoRA training and evaluation studio.

---

## 1. Technology Stack & Environment

| Layer                      | Technology                      | Version / Configuration                                                                                                      |
| :------------------------- | :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| **Package Manager**        | Bun                             | `bun@1.4.4`                                                                                                                  |
| **Framework**              | Vue 3                           | `^3.5.45` (Composition API, `<script setup lang="ts">`)                                                                      |
| **Build & Dev Tool**       | Vite Plus                       | `1.5.0` (`@voidzero-dev/vite-plus-core`)                                                                                     |
| **Type System**            | TypeScript                      | `^7.0.2` (Strict, project references `tsconfig.json` & `tsconfig.node.json`)                                                 |
| **Styling**                | Tailwind CSS v4 & DaisyUI 5     | `@tailwindcss/vite` `^4.3.5`, `daisyui` `^5.7.50` (`fizgig` theme)                                                           |
| **Design System**          | Linear Dark Architecture        | 4-step near-black elevations (`#08090a` to `#111318`), rationed indigo accent (`#5e6ad2`), zero drop-shadows, 1px hairlines  |
| **Typography**             | Inter & JetBrains Mono Variable | `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`                                                          |
| **State Management**       | Pinia                           | `^4.1.0` (`useComposerStore`, `useRunStore`, `useSchemaStore`, `useSystemStore`, `usePlanOverlayStore`)                      |
| **Router**                 | Vue Router                      | `^5.4.0` (HTML5 history mode: `/cockpit`, `/composer`, `/datasets`, `/workbench`, `/system`)                                 |
| **Primitives & Icons**     | Reka UI & Lucide                | `reka-ui` `^2.11.0`, `lucide-vue-next` `^1.0.0`                                                                              |
| **Validation & Utilities** | Zod & VueUse                    | `zod` `^4.6.7`, `@vueuse/core` `^15.0.0`                                                                                     |
| **Notifications**          | Vue Sonner                      | `vue-sonner` `^2.0.9`                                                                                                        |
| **Linter & Formatter**     | oxlint & oxfmt                  | Configured via `.oxlintrc.json` and `.oxfmtrc.json`                                                                          |
| **Backend Proxy & Server** | Vite Middleware & Node HTTP     | `server/fizgig-proxy.ts` & `server/prod-server.ts` (`bun run start`, async `nvidia-smi` telemetry, auto-auth, SSE streaming) |

---

## 2. Directory Structure

```
webui/
├── package.json              # Bun dependencies, scripts, and overrides
├── tsconfig.json             # App TypeScript configuration
├── tsconfig.node.json        # Vite/Node TypeScript configuration
├── vite.config.ts            # Vite Plus config, Tailwind plugin, proxy middleware, path aliases
├── .oxlintrc.json            # oxlint category and plugin rules
├── .oxfmtrc.json            # oxfmt formatting configuration
├── dist/                     # Production build artifacts (git-ignored)
├── server/
│   ├── fizgig-proxy.ts       # Authenticated API reverse proxy & async telemetry enricher
│   └── prod-server.ts        # Standalone production HTTP server for dist/ + proxy
├── shared/
│   └── types.ts              # Canonical shared domain schemas & TypeScript interfaces
└── src/
    ├── api/                  # Typed HTTP client (`client.ts`) & Zod boundary parsers (`schemas.ts`)
    ├── app.css               # Design tokens, DaisyUI theme definition, decoupled font/density variables
    ├── main.ts               # App entrypoint, Pinia & Vue Router instantiation
    ├── App.vue               # Root layout container, visibility-aware polling & global shortcuts
    ├── components/
    │   ├── common/           # Uniform base component primitives (BaseButton, BaseInput, BaseSelect, BasePillGroup, BaseToggle, BaseBadge, BaseCard, BaseModal, PlanOverlayPopup)
    │   ├── cockpit/          # Run cockpit, loss charts, sample galleries, status banners
    │   ├── composer/         # Training plan composer & job authoring
    │   │   ├── ComposerHeaderBar.vue          # 2-row configuration bar, mode toggle & right-aligned preflight warnings
    │   │   ├── ComposerEssentialStudio.vue    # Two-column dynamic-stretching essential workspace
    │   │   ├── ComposerExpertTuning.vue       # Filtered hyperparameter schema editor with grouped toggle panels
    │   │   ├── SubmitQueueModal.vue           # Queue submission preflight confirmation modal
    │   │   └── essential/                     # Essential Studio cards:
    │   │       ├── ComposerDatasetCard.vue    # Training dataset picker, search, auto-name, trigger check
    │   │       ├── ComposerRecipeCard.vue     # Model family recipe card with network rank, optimizer & preset note
    │   │       ├── ComposerScheduleCard.vue   # Epoch slider, quick-epoch pill selectors
    │   │       ├── ComposerPromptsCard.vue    # Multiline validation prompt drafts (one prompt per line)
    │   │       └── ComposerReadinessCard.vue  # COMPUTE DEVICE card, multi-GPU selector & VRAM headroom strip
    │   ├── datasets/         # Dataset browser, paginated Caption Studio, and live Image Prep studio
    │   ├── schema/           # Dynamic form fields (editable combos, cadence, split, interactive blocks)
    │   ├── shell/            # TopTelemetryBar (multi-GPU, CPU, RAM, Disk) & AppIconRail
    │   ├── system/           # Ergonomics, declarative catalog, multi-GPU telemetry, editable prefs
    │   ├── telemetry/        # High-performance SVG loss chart, sample matrix/carousel, live override modal
    │   └── workbench/        # Pointer-drag Block Studio EQ, LoRA Royale, Block Profiler, Metadata Inspector
    ├── pages/                # Top-level page route views (CockpitPage, ComposerPage, DatasetsPage, WorkbenchPage, SystemPage)
    ├── stores/               # Pinia stores (composer, run, schema, system, overlay)
    └── utils/                # Pure formatting (`format.ts`) & hardware/VRAM (`hardware.ts`) utilities
```

---

## 3. Architecture & Key Patterns

### 3.1. Standardized Base Components (`@/components/common`)

To eliminate styling drift and arbitrary duplication across views, all form controls and action buttons **must** use the common primitives:

- `BaseButton`: Cohesive button with variants (`primary`, `secondary`, `neutral`, `outline`, `ghost`, `bare`, `warning`, `error`), sizes (`default`, `compact`, `pill`, `square-default`, `square-compact`, `icon-xs`, `xs`), and built-in icon slots (`#icon-left`, `#icon-right`).
- `BaseInput`: Consistent text/number input supporting `mono`, prefix/suffix icon slots, and standard focus states.
- `BaseSelect`: Clean uniform dropdown select.
- `BasePillGroup`: Segmented pill control for mode switchers and toggle groups.
- `BaseToggle`: Standardized boolean toggle with smooth transitions and visible disabled sliders.
- `BaseModal`: Accessible `<Teleport to="body">` modal with `Escape` key dismissal, backdrop handling, and hairline chrome.
- `BaseCard` & `BaseBadge`: Standardized surface cards and semantic status/mono badges.

### 3.2. Decoupled Ergonomics & Responsive Viewport Sizing

Layout spacing (`--spacing: 4px`, `--spacing: 3.3px` in `compact`) is decoupled from `:root` typography (`data-font-size`: `16px` / `18px` / `20px`) so font scaling and UI density work orthogonally without overflowing viewports.

In `ComposerEssentialStudio.vue`, containers stretch dynamically to occupy available vertical space:

- Cards like `ComposerDatasetCard` and `ComposerPromptsCard` utilize `flex-1 min-h-68 max-h-170`.
- **Sensible Floor (`min-h-68` / 272px)**: Prevents bottom card clipping on compact `1280×800` laptop viewports while preserving scrollable folder lists and prompt editors.
- **Dynamic Headroom**: On standard viewports (>=900px, 1080p, 1440p), both columns expand symmetrically to achieve exact baseline height parity without triggering a page scrollbar.
- **Sensible Ceiling (`max-h-170` / 680px)**: Prevents uncontrolled vertical expansion on 4K or ultrawide screens.

### 3.3. Multi-GPU Selection & Hardware Telemetry

- Physical GPUs are detected via host `nvidia-smi` queries inside `fizgig-proxy.ts` and enriched into `/api/stats`.
- The user's active GPU choice is persisted to the backend preference store (`POST /api/prefs` with `{"changes": {"cuda_device": String(idx)}}`), ensuring child training processes inherit `CUDA_VISIBLE_DEVICES`.
- The `COMPUTE DEVICE` card focuses purely on hardware metrics (GPU selector, free/total VRAM, and dynamic headroom calculation). High OOM risk callouts appear conditionally only when estimated footprint exceeds card capacity.
- General dataset validation and lock warnings live in `ComposerHeaderBar.vue` aligned on the action row alongside `Start Training`.

### 3.4. Number Formatting & Scientific Notation

- All floating-point and hyperparameter displays must route through `formatDecimal` or `formatLearnRate` in `@/utils/format`.
- Scientific notation exponents (e.g. `2e-4`, `2.00e-04`) are automatically converted into readable standard decimals (`0.0002`).

---

## 4. Development & Quality Gates

Every code change must satisfy all five gates before committing:

```bash
# 1. Format code
bun run format

# 2. Check formatting & linting (oxlint)
bun run check

# 3. TypeScript type checking (noEmit)
bun run typecheck

# 4. Unit tests (Vitest / Bun test)
bun test

# 5. Production bundle build
bun run build
```

### Formatting & Linting Conventions

- Use canonical Tailwind CSS spacing classes (`min-h-90`, `max-h-170`, `min-h-13`, `h-6`, `h-8.5`) rather than ad-hoc bracketed values (`min-h-[360px]`).
- Adhere to oxlint rules: inline type imports (`import { type DatasetSummary } from "@shared/types"`), kebab-case or PascalCase filenames, and no circular dependencies.

---

## 5. Git & Workflow Rules

- **Commit First, Never Push**: All development work is kept strictly in local git commits on `main`. Never push to `origin/main` unless explicitly commanded by the user.
- **Atomic Commits**: Group related component and styling updates into concise conventional commits (e.g. `feat(composer): ...`, `refactor(composer): ...`, `style(composer): ...`).
