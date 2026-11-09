<script setup lang="ts">
import { computed, onMounted } from "vue";
import { CheckCircle2, FolderGit2, HardDrive, Package, RefreshCw, Sliders } from "lucide-vue-next";
import { useSystemStore } from "@/stores/system";
import { useRunStore } from "@/stores/run";
import { formatBytes } from "@/api/client";

const systemStore = useSystemStore();
const runStore = useRunStore();

const bundleEntries = computed(() => {
  const bundles = systemStore.localBundles?.bundles ?? {};
  const activeSet = new Set(systemStore.localBundles?.active ?? []);
  return Object.entries(bundles).map(([key, val]) => ({
    key,
    active: activeSet.has(key),
    family: val.family,
    description: val.description ?? "",
    preferences: val.preferences ?? {},
  }));
});

const prefEntries = computed(() => {
  return Object.entries(systemStore.prefs)
    .filter(([, val]) => typeof val === "string" || typeof val === "number")
    .toSorted(([a], [b]) => a.localeCompare(b));
});

function resolveSpecLabel(spec: unknown): string {
  if (spec && typeof spec === "object") {
    const rec = spec as Record<string, unknown>;
    if (typeof rec.path === "string" && rec.path) return rec.path;
    if (typeof rec.source === "string" && rec.source) return rec.source;
  }
  return "configured";
}

onMounted(async () => {
  await Promise.all([systemStore.fetchLocalBundles(), systemStore.fetchPrefs()]);
});
</script>

<template>
  <div class="h-[calc(100vh-44px)] overflow-y-auto bg-base-100 p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <!-- Section 1: UI Ergonomics & Density -->
      <section class="rounded-lg border border-base-300 bg-base-200/80 p-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <Sliders class="h-4 w-4 text-primary" />
            <div>
              <h2 class="text-sm font-semibold text-base-content">
                UI Density & Pedagogical Prose Mode
              </h2>
              <p class="text-xs text-base-content/60">
                Customize control spacing and whether upstream Fizgig's verbose tutorial prose
                blocks are shown inline.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- Font Scale Selector -->
            <div class="join border border-base-300">
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="systemStore.fontScale === 'normal' ? 'btn-primary' : 'btn-ghost'"
                @click="systemStore.setFontScale('normal')"
              >
                Normal (16px)
              </button>
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="systemStore.fontScale === 'large' ? 'btn-primary' : 'btn-ghost'"
                @click="systemStore.setFontScale('large')"
              >
                Large (18px)
              </button>
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="systemStore.fontScale === 'xlarge' ? 'btn-primary' : 'btn-ghost'"
                @click="systemStore.setFontScale('xlarge')"
              >
                XL (20px)
              </button>
            </div>

            <div class="join">
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="
                  systemStore.density === 'default'
                    ? 'btn-primary'
                    : 'btn-ghost border border-base-300'
                "
                @click="systemStore.density = 'default'"
              >
                Standard (34px)
              </button>
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="
                  systemStore.density === 'compact'
                    ? 'btn-primary'
                    : 'btn-ghost border border-base-300'
                "
                @click="systemStore.density = 'compact'"
              >
                Compact (28px)
              </button>
            </div>

            <label
              class="flex cursor-pointer items-center gap-2 rounded border border-base-300 bg-base-300/50 px-3 py-1.5 text-xs"
            >
              <input
                v-model="systemStore.explainMode"
                type="checkbox"
                class="toggle toggle-xs toggle-primary"
              />
              <span>Show Explain Prose</span>
            </label>
          </div>
        </div>
      </section>

      <!-- Section 2: Native fizgig-docker Model Bundles (models.json) -->
      <section class="rounded-lg border border-base-300 bg-base-200/80 p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <Package class="h-4 w-4 text-secondary" />
            <div>
              <h2 class="text-sm font-semibold text-base-content">
                Declarative Model Catalog (`models.json`)
              </h2>
              <p class="text-xs text-base-content/60">
                First-class integration with `/srv/appdata/fizgig/config/models.json` and
                `fizgig_local` bundle hydration.
              </p>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-xs btn-ghost border border-base-300"
            @click="systemStore.fetchLocalBundles()"
          >
            <RefreshCw class="h-3.5 w-3.5" />
            Reload Catalog
          </button>
        </div>

        <div
          v-if="systemStore.localBundles?.externalRoots"
          class="flex flex-wrap items-center gap-2 rounded border border-base-300 bg-base-300/40 px-3 py-2 text-xs"
        >
          <FolderGit2 class="h-3.5 w-3.5 text-info" />
          <span class="font-semibold text-base-content/75">External Mount Roots:</span>
          <span
            v-for="(val, key) in systemStore.localBundles.externalRoots"
            :key="key"
            class="badge badge-sm border-base-300 bg-base-200 font-mono text-[11px]"
          >
            {{ key }}: {{ val }}
          </span>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            v-for="bundle in bundleEntries"
            :key="bundle.key"
            class="rounded-lg border p-3.5 transition-colors"
            :class="
              bundle.active ? 'border-success/40 bg-success/5' : 'border-base-300 bg-base-300/30'
            "
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold text-base-content">
                  {{ bundle.key }}
                </span>
                <span class="badge badge-xs badge-outline font-mono">
                  {{ bundle.family }}
                </span>
              </div>
              <span v-if="bundle.active" class="badge badge-xs badge-success gap-1 font-medium">
                <CheckCircle2 class="h-2.5 w-2.5" />
                active
              </span>
            </div>

            <p v-if="bundle.description" class="mt-1.5 text-xs text-base-content/65">
              {{ bundle.description }}
            </p>

            <div class="mt-2.5 space-y-1 border-t border-base-300/70 pt-2">
              <div
                v-for="(spec, prefKey) in bundle.preferences"
                :key="prefKey"
                class="flex items-center justify-between gap-2 font-mono text-[11px]"
              >
                <span class="text-base-content/55">{{ prefKey }}</span>
                <span class="truncate text-base-content/85">
                  {{ resolveSpecLabel(spec) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Hardware & Container Mount Telemetry -->
      <section
        v-if="runStore.stats"
        class="rounded-lg border border-base-300 bg-base-200/80 p-5 space-y-3"
      >
        <div class="flex items-center gap-2.5">
          <HardDrive class="h-4 w-4 text-info" />
          <h2 class="text-sm font-semibold text-base-content">
            Compute Device & Storage Telemetry
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded border border-base-300 bg-base-300/40 p-3">
            <div class="text-[11px] uppercase tracking-wider text-base-content/50">Accelerator</div>
            <div class="mt-1 font-mono text-xs font-semibold text-base-content">
              {{ runStore.stats.device_name }}
            </div>
            <div class="mt-1 font-mono text-[11px] text-base-content/65">
              VRAM Peak: {{ formatBytes(runStore.stats.vram_peak) }}
            </div>
          </div>

          <div class="rounded border border-base-300 bg-base-300/40 p-3">
            <div class="text-[11px] uppercase tracking-wider text-base-content/50">
              System Memory
            </div>
            <div class="mt-1 font-mono text-xs font-semibold text-base-content">
              {{ formatBytes(runStore.stats.ram[0]) }} / {{ formatBytes(runStore.stats.ram[1]) }}
            </div>
            <div class="mt-1 font-mono text-[11px] text-base-content/65">
              RAM Peak: {{ formatBytes(runStore.stats.ram_peak) }}
            </div>
          </div>

          <div class="rounded border border-base-300 bg-base-300/40 p-3">
            <div class="text-[11px] uppercase tracking-wider text-base-content/50">
              Workspace Storage ({{ runStore.stats.disk.path }})
            </div>
            <div class="mt-1 font-mono text-xs font-semibold text-base-content">
              {{ formatBytes(runStore.stats.disk.free) }} Free
            </div>
            <div class="mt-1 font-mono text-[11px] text-base-content/65">
              Total: {{ formatBytes(runStore.stats.disk.total) }}
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: Active Fizgig Preference Paths (/api/prefs) -->
      <section class="rounded-lg border border-base-300 bg-base-200/80 p-5 space-y-3">
        <h2 class="text-sm font-semibold text-base-content">
          Resolved Container Model Paths (`/api/prefs`)
        </h2>
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            v-for="[key, val] in prefEntries"
            :key="key"
            class="flex items-center justify-between gap-3 rounded border border-base-300 bg-base-300/40 px-3 py-2 font-mono text-xs"
          >
            <span class="shrink-0 text-base-content/60">{{ key }}</span>
            <span class="truncate text-right text-base-content/90">{{ val }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
