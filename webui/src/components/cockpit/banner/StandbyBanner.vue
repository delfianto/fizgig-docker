<script setup lang="ts">
import { ArrowRight, History, RotateCcw, Sparkles } from "lucide-vue-next";
import { BaseButton } from "@/components/common";

defineProps<{
  sessionDismissed: boolean;
  lastRunLora?: string;
}>();

const emit = defineEmits<{
  (e: "restore-session"): void;
  (e: "view-history"): void;
}>();
</script>

<template>
  <section
    class="rounded-xl border border-hairline bg-base-300 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-9 w-9 items-center justify-center rounded-lg bg-base-200 border border-hairline text-subtle"
      >
        <Sparkles class="h-4 w-4 text-primary" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-base-content">Trainer Standby</span>
          <span class="badge badge-sm badge-ghost border-hairline font-mono text-[10px]">IDLE</span>
        </div>
        <p class="text-xs text-muted">No active training run. Hardware is ready for compute.</p>
      </div>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <BaseButton
        v-if="sessionDismissed && lastRunLora"
        size="compact"
        variant="ghost"
        class="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        title="Restore the previously dismissed run in the monitor"
        @click="emit('restore-session')"
      >
        <template #icon-left><RotateCcw class="h-3 w-3" /></template>
        <span>Re-open {{ lastRunLora }}</span>
      </BaseButton>

      <router-link
        to="/composer"
        class="btn btn-sm h-7.5 rounded-md btn-primary gap-1.5 px-3 text-xs font-semibold shadow-xs cursor-pointer"
      >
        <span>Launch Run in Composer</span>
        <ArrowRight class="h-3.5 w-3.5" />
      </router-link>

      <BaseButton size="compact" variant="ghost" @click="emit('view-history')">
        <template #icon-left><History class="h-3.5 w-3.5" /></template>
        <span>Browse History</span>
      </BaseButton>
    </div>
  </section>
</template>
