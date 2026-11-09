<script setup lang="ts">
import { AlertTriangle, Cpu, ShieldAlert, ShieldCheck } from "lucide-vue-next";
import { useRunStore } from "@/stores/run";

defineProps<{
  isSelectedDatasetReady: boolean;
}>();

const runStore = useRunStore();
</script>

<template>
  <section
    class="rounded-xl border p-2.5 space-y-1.5 transition-colors"
    :class="
      isSelectedDatasetReady ? 'border-primary/30 bg-primary/5' : 'border-warning/30 bg-warning/5'
    "
  >
    <div class="flex items-center justify-between border-b border-hairline/60 pb-1.5">
      <div class="flex items-center gap-2">
        <ShieldCheck v-if="isSelectedDatasetReady" class="h-4 w-4 text-primary" />
        <ShieldAlert v-else class="h-4 w-4 text-warning" />
        <h3 class="text-xs font-bold uppercase tracking-wider text-base-content">
          Compute &amp; Readiness
        </h3>
      </div>
      <span
        class="badge badge-sm font-semibold text-[11px]"
        :class="isSelectedDatasetReady ? 'badge-success' : 'badge-warning'"
      >
        {{ isSelectedDatasetReady ? "Ready to Train" : "Incomplete Dataset" }}
      </span>
    </div>

    <!-- Compact Telemetry Row -->
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="flex items-center gap-1.5 rounded bg-base-300/70 px-2.5 py-1.5">
        <Cpu class="h-3.5 w-3.5 text-primary shrink-0" />
        <span class="font-mono font-medium text-base-content truncate text-[11px]">
          {{ runStore.stats?.device_name || "NVIDIA RTX 4080" }}
        </span>
      </div>

      <div class="flex items-center justify-between rounded bg-base-300/70 px-2.5 py-1.5">
        <span class="text-[11px] text-muted">Est. VRAM:</span>
        <span class="font-mono font-semibold text-success text-[11px]"> ~11.8 / 16.0 GB </span>
      </div>
    </div>

    <!-- Direction text pointing to top header buttons -->
    <div
      v-if="isSelectedDatasetReady"
      class="flex items-center justify-between text-[11px] text-muted pt-0.5"
    >
      <span>Launch training or queue the job from the header bar above.</span>
      <span class="font-mono text-primary font-medium">Ready ↑</span>
    </div>
    <div v-else class="flex items-center gap-1.5 text-[11px] text-warning pt-0.5">
      <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
      <span>Training locked: dataset must be 100% tagged before launch.</span>
    </div>
  </section>
</template>
