<script setup lang="ts">
import { computed } from "vue";
import { useSystemStore } from "@/stores/system";

const systemStore = useSystemStore();

const prefEntries = computed(() => {
  return Object.entries(systemStore.prefs)
    .filter(([, val]) => typeof val === "string" || typeof val === "number")
    .toSorted(([a], [b]) => a.localeCompare(b));
});
</script>

<template>
  <section class="rounded-lg border border-base-300 bg-base-200/80 p-5 space-y-3">
    <h2 class="text-sm font-semibold text-base-content">
      Resolved Container Model Paths (<code class="text-xs font-mono">/api/prefs</code>)
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
</template>
