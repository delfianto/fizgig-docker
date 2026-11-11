<script setup lang="ts">
import { Copy, History, RotateCcw } from "lucide-vue-next";
import { type HistoricalRun } from "@shared/types";
import { BaseButton } from "@/components/common";

defineProps<{
  run: HistoricalRun;
  isActiveOrStarting: boolean;
}>();

const emit = defineEmits<{
  (e: "clone", run: HistoricalRun): void;
  (e: "return-to-live"): void;
}>();

function formatTime(timestamp?: number | null): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}
</script>

<template>
  <section class="rounded-xl border border-info/30 bg-info/5 p-4 shadow-xs space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-info/20 pb-3">
      <div class="flex items-center gap-2 flex-wrap min-w-0">
        <span
          class="rounded bg-info/15 border border-info/30 px-2 py-0.5 text-xs font-semibold text-info flex items-center gap-1.5"
        >
          <History class="h-3.5 w-3.5" />
          <span>Archived Run</span>
        </span>
        <span class="text-sm font-bold font-mono text-base-content truncate">
          {{ run.lora }}
        </span>
        <span class="badge badge-sm badge-neutral border-hairline font-mono text-[11px]">
          {{ run.family_label || run.family }}
        </span>
        <span
          v-if="run.status || run.result"
          class="badge badge-sm badge-ghost border-hairline font-mono text-[11px] capitalize"
        >
          {{ run.status || run.result }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <BaseButton
          size="compact"
          variant="ghost"
          title="Load this historical run's settings into Composer"
          @click="emit('clone', run)"
        >
          <template #icon-left><Copy class="h-3.5 w-3.5 text-primary" /></template>
          <span>Clone to Composer</span>
        </BaseButton>

        <BaseButton
          size="compact"
          :variant="isActiveOrStarting ? 'warning' : 'ghost'"
          :class="isActiveOrStarting ? 'animate-pulse' : ''"
          @click="emit('return-to-live')"
        >
          <template #icon-left><RotateCcw class="h-3.5 w-3.5" /></template>
          <span>{{ isActiveOrStarting ? "Return to Active Run" : "Close Archive View" }}</span>
        </BaseButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted font-mono">
      <div class="flex items-center gap-2 truncate">
        <span>Dataset: <span class="text-base-content">{{ run.image_folder }}</span></span>
        <span v-if="run.lowest_loss">
          · Lowest loss:
          <strong class="text-success">{{ Number(run.lowest_loss).toFixed(4) }}</strong>
          <template v-if="run.lowest_epoch"> (ep {{ run.lowest_epoch }})</template>
        </span>
      </div>
      <div v-if="run.ended_at || run.finished_at">
        Finished:
        {{ formatTime(run.ended_at || run.finished_at) }}
      </div>
    </div>
  </section>
</template>
