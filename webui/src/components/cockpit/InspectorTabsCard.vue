<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { Download, FileCode2, Terminal } from "lucide-vue-next";
import { type CheckpointItem, type HistoricalRun } from "@shared/types";
import { downloadUrl, formatBytes } from "@/api/client";
import { BasePillGroup } from "@/components/common";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  checkpoints: CheckpointItem[];
  outputDir: string;
  consoleLog: string;
  inspectingHistoricalRun: HistoricalRun | null;
}>();

const runStore = useRunStore();
const bottomTab = ref<"checkpoints" | "console" | "spec">("checkpoints");
const logContainerRef = ref<HTMLDivElement | null>(null);

function scrollToBottom(): void {
  if (logContainerRef.value) {
    logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
  }
}

watch(
  () => props.consoleLog,
  () => {
    if (bottomTab.value === "console") {
      void nextTick(scrollToBottom);
    }
  },
);

watch(bottomTab, (tab) => {
  if (tab === "console") {
    void nextTick(scrollToBottom);
  }
});
</script>

<template>
  <div
    class="flex flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-base-300 min-h-55"
  >
    <div
      class="flex items-center justify-between border-b border-hairline bg-base-200 px-3 py-1.5 text-xs"
    >
      <BasePillGroup
        :model-value="bottomTab"
        :options="[
          { value: 'checkpoints', label: 'Checkpoints', icon: Download },
          { value: 'console', label: 'Console Log', icon: Terminal },
          { value: 'spec', label: 'Launch Spec', icon: FileCode2 },
        ]"
        @update:model-value="
          (val) => {
            bottomTab = val as 'checkpoints' | 'console' | 'spec';
            if (val === 'console') runStore.pollLog();
          }
        "
      />

      <span class="font-mono text-[11px] text-muted truncate max-w-sm">
        {{ outputDir }}
      </span>
    </div>

    <!-- Tab 1: Checkpoints List -->
    <div
      v-if="bottomTab === 'checkpoints'"
      class="flex-1 divide-y divide-hairline overflow-y-auto text-xs"
    >
      <div v-if="checkpoints.length === 0" class="p-6 text-center text-muted">
        No checkpoints saved for this run yet.
      </div>
      <div
        v-for="ckpt in checkpoints"
        :key="ckpt.path"
        class="flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-hover"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="font-mono text-sm font-semibold text-base-content">
            {{ ckpt.name }}
          </span>
          <span
            v-if="ckpt.epoch"
            class="rounded bg-base-200 px-2 py-0.5 font-mono text-xs text-subtle"
          >
            Epoch {{ ckpt.epoch }}
          </span>
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <span class="font-mono-num text-xs text-muted">
            {{ formatBytes(ckpt.size) }}
          </span>
          <a
            :href="downloadUrl(ckpt.path)"
            class="btn btn-sm h-7.5 rounded-md btn-ghost border border-hairline bg-base-200 hover:border-primary text-xs font-semibold px-2.5 gap-1.5"
          >
            <Download class="h-3.5 w-3.5 text-primary" />
            <span>Download</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Tab 2: Raw Console Stdout -->
    <div
      v-else-if="bottomTab === 'console'"
      ref="logContainerRef"
      class="flex-1 overflow-y-auto bg-base-100 p-3 font-mono text-[11px] leading-relaxed text-subtle"
    >
      <pre class="whitespace-pre-wrap">{{ consoleLog || "No console output captured." }}</pre>
    </div>

    <!-- Tab 3: Launch Spec (Read-Only) -->
    <div v-else class="flex-1 overflow-y-auto bg-base-100 p-3 font-mono text-[11px] text-subtle">
      <div class="mb-2 flex items-center justify-between">
        <span class="font-sans text-xs font-medium text-base-content">
          Frozen Launch Values ({{ inspectingHistoricalRun?.lora || runStore.run?.lora }})
        </span>
      </div>
      <pre class="whitespace-pre-wrap">{{
        JSON.stringify(inspectingHistoricalRun?.values ?? runStore.run?.values ?? {}, null, 2)
      }}</pre>
    </div>
  </div>
</template>
