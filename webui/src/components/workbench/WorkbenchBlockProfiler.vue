<script setup lang="ts">
defineProps<{
  profilerStatus: Record<string, unknown> | null;
}>();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl rounded-lg border border-base-300 bg-base-200 p-5 space-y-4">
      <h2 class="text-sm font-semibold text-base-content">Automated Block Importance Profiler</h2>
      <p class="text-xs text-base-content/60">
        Measure per-block gradient norm and reconstruction delta across transformer blocks for the
        selected LoRA checkpoint.
      </p>
      <div v-if="profilerStatus" class="rounded bg-base-300/70 p-3 font-mono text-xs">
        {{ JSON.stringify(profilerStatus, null, 2) }}
      </div>
    </div>
  </div>
</template>
