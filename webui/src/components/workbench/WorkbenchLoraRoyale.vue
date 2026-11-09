<script setup lang="ts">
import { type CheckpointItem } from "@shared/types";

defineProps<{
  checkpoints: CheckpointItem[];
  royaleStatus: Record<string, unknown> | null;
}>();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl rounded-lg border border-base-300 bg-base-200 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-base-content">
            LoRA Royale — Multi-Epoch Tournament &amp; Likeness Arena
          </h2>
          <p class="text-xs text-base-content/60">
            Compare saved epoch checkpoints side-by-side using identical seeds and automated
            likeness/style scoring.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <div
          v-for="ckpt in checkpoints.slice(0, 12)"
          :key="ckpt.path"
          class="flex items-center justify-between rounded border border-base-300 bg-base-300/50 px-3 py-2"
        >
          <div class="min-w-0">
            <div class="truncate font-mono text-xs font-semibold text-base-content">
              {{ ckpt.name }}
            </div>
            <div class="font-mono text-[10px] text-base-content/50">
              {{ ckpt.run || "root" }}
            </div>
          </div>
          <span class="badge badge-xs badge-primary font-mono"> ep {{ ckpt.epoch ?? "?" }} </span>
        </div>
      </div>

      <div v-if="royaleStatus" class="rounded bg-base-300/70 p-3 font-mono text-xs">
        {{ JSON.stringify(royaleStatus, null, 2) }}
      </div>
    </div>
  </div>
</template>
