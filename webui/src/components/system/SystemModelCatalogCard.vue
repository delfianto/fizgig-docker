<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle2, FolderGit2, Package, RefreshCw } from "lucide-vue-next";
import { useSystemStore } from "@/stores/system";

const systemStore = useSystemStore();

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

function resolveSpecLabel(spec: unknown): string {
  if (spec && typeof spec === "object") {
    const rec = spec as Record<string, unknown>;
    if (typeof rec.path === "string" && rec.path) return rec.path;
    if (typeof rec.source === "string" && rec.source) return rec.source;
  }
  return "configured";
}
</script>

<template>
  <section class="rounded-lg border border-base-300 bg-base-200/80 p-5 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <Package class="h-4 w-4 text-secondary" />
        <div>
          <h2 class="text-sm font-semibold text-base-content">
            Declarative Model Catalog (<code class="text-xs font-mono">models.json</code>)
          </h2>
          <p class="text-xs text-base-content/60">
            First-class integration with
            <code class="text-xs font-mono">/srv/appdata/fizgig/config/models.json</code> and
            <code class="text-xs font-mono">fizgig_local</code> bundle hydration.
          </p>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-sm h-7.5 rounded-md btn-ghost border border-hairline bg-base-100 hover:border-primary text-xs font-semibold px-2.5 gap-1.5 cursor-pointer transition"
        @click="systemStore.fetchLocalBundles()"
      >
        <RefreshCw class="h-3.5 w-3.5" />
        <span>Reload Catalog</span>
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
        :class="bundle.active ? 'border-success/40 bg-success/5' : 'border-base-300 bg-base-300/30'"
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
</template>
