<script setup lang="ts">
import { onMounted } from "vue";
import { useSystemStore } from "@/stores/system";
import { useRunStore } from "@/stores/run";
import SystemErgonomicsCard from "@/components/system/SystemErgonomicsCard.vue";
import SystemHardwareTelemetryCard from "@/components/system/SystemHardwareTelemetryCard.vue";
import SystemModelCatalogCard from "@/components/system/SystemModelCatalogCard.vue";
import SystemResolvedPathsCard from "@/components/system/SystemResolvedPathsCard.vue";

const systemStore = useSystemStore();
const runStore = useRunStore();

onMounted(async () => {
  await Promise.all([systemStore.fetchLocalBundles(), systemStore.fetchPrefs()]);
});
</script>

<template>
  <div class="h-full overflow-y-auto bg-base-100 p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <!-- Section 1: UI Ergonomics & Density -->
      <SystemErgonomicsCard />

      <!-- Section 2: Native fizgig-docker Model Bundles (models.json) -->
      <SystemModelCatalogCard />

      <!-- Section 3: Hardware & Container Mount Telemetry -->
      <SystemHardwareTelemetryCard v-if="runStore.stats" :stats="runStore.stats" />

      <!-- Section 4: Active Fizgig Preference Paths (/api/prefs) -->
      <SystemResolvedPathsCard />
    </div>
  </div>
</template>
