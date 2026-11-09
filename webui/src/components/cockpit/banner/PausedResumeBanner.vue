<script setup lang="ts">
import { ref } from "vue";
import { Pause, Play } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type LiveRunResponse } from "@shared/types";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  run: LiveRunResponse;
}>();

const runStore = useRunStore();
const busyAction = ref<string | null>(null);

async function handleResume(): Promise<void> {
  busyAction.value = "resume";
  try {
    await runStore.resumeTraining();
    toast.success("Resumed training run");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to resume run");
  } finally {
    busyAction.value = null;
  }
}
</script>

<template>
  <section
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs"
  >
    <div class="flex items-center gap-2.5">
      <Pause class="h-4 w-4 text-warning" />
      <div>
        <span class="font-medium text-warning">Paused run ready to resume:</span>
        <strong class="ml-1.5 font-mono text-base-content">{{ run.resume }}</strong>
        <span class="ml-1.5 rounded bg-base-300 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          {{ run.family }}
        </span>
      </div>
    </div>
    <button
      type="button"
      class="btn btn-sm h-7.5 rounded-md btn-primary px-3 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
      :disabled="busyAction !== null"
      @click="handleResume"
    >
      <Play class="h-3.5 w-3.5" />
      <span>Resume Run</span>
    </button>
  </section>
</template>
