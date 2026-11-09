# 04 — Tech Stack, VoidZero Toolchain & Frontend Architecture

## 1. Core Stack Matrix

The frontend lives in `/srv/project/github/fizgig-docker/ui/` and uses the modern **VoidZero Vite+ / Vue 3.5 / TypeScript 7.x / Tailwind CSS 4 / DaisyUI 5** stack consistent with sibling repositories (`stash-tools`, `orange-loaf`, `inkwell`, `schema-form`).

| Layer | Package & Version | Role |
| --- | --- | --- |
| **Unified Toolchain & Bundler** | `vite-plus` (`1.5.0`) + `@voidzero-dev/vite-plus-core` (`1.5.0`) | Single CLI (`vp`) wrapping Rolldown-powered Vite builds, dev server, Oxlint, Oxfmt, and Vitest. |
| **Linter & Formatter** | `oxlint` + `oxlint-tsgolint` + `oxfmt` (via `vp check`) | Rust-native linting and formatting via `.oxlintrc.json` and `.oxfmtrc.json`. |
| **TypeScript Compiler** | `typescript` (`^7.0.2` / `@typescript/native` `tsgo`) + `vue-tsc` (`^3.3.14`) | Native TypeScript 7.x type checking + Vue SFC template verification in strict mode. |
| **UI Framework** | `vue` (`^3.5.45`) + `@vitejs/plugin-vue` (`^6.0.10`) | `<script setup lang="ts">` Composition API, reactivity system, and custom directives. |
| **State Management** | `pinia` (`^4.1.0`) | Modular composition stores with strict separation between live telemetry (`useRunStore`) and draft configuration (`useComposerStore`). |
| **Routing** | `vue-router` (`^5.4.0`) | Client-side routing across `/cockpit`, `/composer`, `/datasets`, `/workbench`, and `/system`. |
| **CSS & Design System** | `tailwindcss` (`^4.3.5`) + `@tailwindcss/vite` (`^4.3.5`) + `daisyui` (`^5.7.50`) | CSS-first Tailwind v4 engine + DaisyUI 5 semantic primitives restyled with the `fizgig` Linear-dark theme. |
| **Headless UI Primitives** | `reka-ui` (`^2.11.0`) | Accessible headless Vue primitives for Comboboxes, Popovers (`?` field hints), Dialogs, Splitters, and Slider thumbs. |
| **Utilities & Icons** | `@vueuse/core` (`^15.0.0`), `lucide-vue-next` (`^1.0.0`), `vue-sonner` (`^2.0.9`), `zod` (`^4.6.7`) | Composable timers/shortcuts/observers, crisp 1.5px stroke icons, toast notifications, and runtime schema validation. |
| **Fonts** | `@fontsource-variable/inter` (`^5.3.0`), `@fontsource-variable/jetbrains-mono` (`^5.3.0`) | Bundled local variable fonts (works 100% offline with `FIZGIG_OFFLINE=1`, zero external Google Fonts requests). |

---

## 2. Directory Structure (`ui/` inside `fizgig-docker`)

```
/srv/project/github/fizgig-docker/
├── src/
│   ├── fizgig_local/             # Existing manifest bundle resolver
│   └── fizgig_mcp/               # Existing Starlette/Uvicorn companion + UI BFF routes
│       ├── adapter.py            # FizgigAPI client (shared by MCP and UI shim)
│       ├── server.py             # Mounts /mcp, /health, /ui-api/*, and static SPA
│       └── ui_routes.py          # Proxy & local manifest bundle endpoints for the SPA
├── ui/                           # Frontend workspace (Vite+ / Vue 3.5 / TS 7.x)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .oxlintrc.json
│   ├── .oxfmtrc.json
│   ├── shared/
│   │   └── types.ts              # Pure TypeScript interfaces & Zod schemas for Fizgig API
│   └── src/
│       ├── app.css               # Tailwind v4 + DaisyUI 5 "fizgig" dark theme tokens
│       ├── main.ts               # App bootstrap, Pinia, Vue Router
│       ├── App.vue               # 100vh shell: 64px IconRail + 44px TopTelemetryBar + RouterView
│       ├── api/
│       │   └── client.ts         # Typed fetch wrapper for /ui-api/* with error normalization
│       ├── stores/
│       │   ├── run.ts            # Polls /api/run, /api/stats, /api/runs/loss?live=1 (read-only telemetry)
│       │   ├── schema.ts         # Caches /api/schema families, presets, and row definitions
│       │   ├── composer.ts       # Isolated draft state, preset diff computation, /api/form/state, /api/plan
│       │   ├── datasets.ts       # Dataset list, captions grid, bulk replace, prep & SAM masks
│       │   ├── workbench.ts      # Studio block vector state, LoRA Royale crossfader, Profiler, Metadata
│       │   └── system.ts         # fizgig_local bundles, prefs, GPU selection, UI density
│       ├── components/
│       │   ├── shell/
│       │   │   ├── AppIconRail.vue
│       │   │   ├── TopTelemetryBar.vue
│       │   │   └── ConfirmActionPopover.vue
│       │   ├── schema/
│       │   │   ├── SchemaField.vue        # Renders all 13 upstream row kinds
│       │   │   ├── SchemaSectionDrawer.vue
│       │   │   ├── FieldHintPopover.vue   # Replaces inline prose walls with ? popover
│       │   │   └── PresetDiffBadge.vue    # 1-click field reset to preset baseline
│       │   ├── telemetry/
│       │   │   ├── LossChartCanvas.vue    # High-DPI Canvas/SVG step/EMA/LR chart with epoch sync
│       │   │   ├── ImageLossHeatmap.vue   # Per-image residual table & quick caption editor
│       │   │   ├── SampleMatrixGrid.vue   # Prompt × Epoch structured matrix
│       │   │   ├── SampleCompareModal.vue # A/B split, crossfade scrubber & zoom lightbox
│       │   │   └── LivePreviewDrawer.vue  # Explicit modal for .sample_override.json
│       │   └── workbench/
│       │       ├── BlockEqCanvas.vue      # Interactive parametric-EQ bar editor for Studio blocks
│       │       └── RoyaleCrossfader.vue   # 60fps epoch crossfade stage
│       └── pages/
│           ├── CockpitPage.vue
│           ├── ComposerPage.vue
│           ├── DatasetsPage.vue
│           ├── WorkbenchPage.vue
│           └── SystemPage.vue
```

---

## 3. Configuration Files Specification

### 3.1 `ui/package.json`

```json
{
  "name": "fizgig-ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vp dev",
    "build": "vue-tsc -p tsconfig.json --noEmit && vp build",
    "typecheck": "vue-tsc -p tsconfig.json --noEmit",
    "check": "vp fmt --check -c .oxfmtrc.json && vp lint -c .oxlintrc.json",
    "check:fix": "vp fmt --write -c .oxfmtrc.json && vp lint -c .oxlintrc.json --fix",
    "lint": "vp lint -c .oxlintrc.json src shared",
    "format": "vp fmt --write -c .oxfmtrc.json",
    "test": "vp test run"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.3.0",
    "@fontsource-variable/jetbrains-mono": "^5.3.0",
    "@vueuse/core": "^15.0.0",
    "lucide-vue-next": "^1.0.0",
    "pinia": "^4.1.0",
    "reka-ui": "^2.11.0",
    "vue": "^3.5.45",
    "vue-router": "^5.4.0",
    "vue-sonner": "^2.0.9",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.5",
    "@types/node": "^26.6.6",
    "@typescript/native": "npm:typescript@7.0.2",
    "@vitejs/plugin-vue": "^6.0.10",
    "@voidzero-dev/vite-plus-core": "1.5.0",
    "daisyui": "^5.7.50",
    "tailwindcss": "^4.3.5",
    "typescript": "^7.0.2",
    "vite": "npm:@voidzero-dev/vite-plus-core@1.5.0",
    "vite-plus": "1.5.0",
    "vitest": "^5.1.0",
    "vue-tsc": "^3.3.14"
  },
  "overrides": {
    "vite": "npm:@voidzero-dev/vite-plus-core@1.5.0"
  }
}
```

### 3.2 `ui/vite.config.ts`

```ts
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

const bffTarget = process.env.FIZGIG_BFF_URL ?? "http://127.0.0.1:8084";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: bffTarget, changeOrigin: true },
      "/ui-api": { target: bffTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
```

### 3.3 `ui/tsconfig.json` (TypeScript 7.x Strict Mode)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "preserve",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "shared/**/*.ts", "vite.config.ts"]
}
```

### 3.4 `ui/.oxlintrc.json`

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc", "import", "promise"],
  "categories": {
    "correctness": "error",
    "suspicious": "error",
    "perf": "error"
  },
  "rules": {
    "sort-imports": ["error", { "ignoreCase": true }],
    "import/first": "error",
    "import/no-duplicates": "error",
    "import/no-cycle": "error",
    "import/no-self-import": "error",
    "import/consistent-type-specifier-style": ["error", "prefer-inline"],
    "unicorn/no-null": "off",
    "unicorn/filename-case": ["error", { "cases": { "kebabCase": true, "pascalCase": true } }]
  }
}
```

---

## 4. State Architecture & Pinia Store Contracts

### 4.1 `useRunStore` (`src/stores/run.ts`) — Read-Only Live Telemetry & Explicit Execution
- **Polled State (`2000ms` interval via `useIntervalFn`):**
  - `runState`: response from `GET /api/run` (`running`, `state`, `stage`, `lora`, `family`, `values`, `image_folder`, `progress`, `web_queue`).
  - `gpuStats`: response from `GET /api/stats` (`vram`, `ram`, `vram_peak`, `ram_peak`, `device_name`, `disk`, `loaded`).
  - `liveLoss`: response from `GET /api/runs/loss?live=1` (polled every `5000ms` while `running === true`).
- **Explicit Actions (Never Triggered by Draft Form Edits):**
  - `triggerSampleNow()` -> `POST /api/run/now` `{ kind: "sample" }`
  - `triggerSaveNow()` -> `POST /api/run/now` `{ kind: "save" }`
  - `pauseRun()` -> `POST /api/pause` `{}`
  - `resumeRun()` -> `POST /api/resume` `{}`
  - `stopRun()` -> `POST /api/stop` `{}`
  - `applyLiveSampleOverride(payload)` -> `POST /api/run/sample_override` (called **only** when the user clicks "Apply Override" inside `LivePreviewDrawer.vue`).

### 4.2 `useComposerStore` (`src/stores/composer.ts`) — Isolated Draft & Preset Diffing
- **State:**
  - `family: string` (selected family key, e.g., `"krea2"`)
  - `presetName: string` (selected preset name)
  - `baselineValues: Record<string, unknown>` (snapshot of values when the preset was loaded)
  - `draftValues: Record<string, unknown>` (user's working values in Composer)
  - `imageFolder: string` (selected `/datasets/...` path)
  - `formState`: live response from `POST /api/form/state` (debounced `250ms` on `draftValues` or `imageFolder` change; contains `hidden`, `disabled`, `notes`, `placeholders`, `kind`).
  - `planResult`: response from `POST /api/plan` (`problems`, `warnings`, `summary`).
- **Computed Getters:**
  - `modifiedKeys`: `Set<string>` of keys where `draftValues[k] !== baselineValues[k]`.
  - `curatedSections` vs `advancedSections`: splits the family's `form.sections` into core 3-column grid fields and collapsible bottom drawers.
- **Actions:**
  - `selectFamily(key)` -> loads family schema and applies first preset into `draftValues` & `baselineValues` locally (without touching `/api/run/sample_override`).
  - `applyPreset(name)` -> calls `POST /api/preset`, updates `draftValues` and `baselineValues`.
  - `resetField(key)` -> restores `draftValues[key] = baselineValues[key]`.
  - `loadFromHistoricalRun(runId)` -> populates `draftValues` from a past run's saved `values` for quick cloning.
  - `validatePlan()` -> calls `POST /api/plan` and opens the preflight summary.
  - `submitStart()` / `submitQueue()` -> runs `validatePlan()` first; if no blockers, calls `POST /api/start` or `POST /api/queue/add`.
