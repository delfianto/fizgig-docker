<script setup lang="ts">
import { Activity, Download, FileCode2, RefreshCw, Sliders, Trophy } from "lucide-vue-next";
import { type CheckpointItem } from "@shared/types";
import { downloadUrl } from "@/api/client";

defineProps<{
  activeTool: "studio" | "royale" | "profiler" | "metadata";
  selectedLoraPath: string;
  checkpoints: CheckpointItem[];
  selectedCheckpoint?: CheckpointItem;
}>();

const emit = defineEmits<{
  (e: "set-tool", tool: "studio" | "royale" | "profiler" | "metadata"): void;
  (e: "select-lora", path: string): void;
  (e: "refresh-checkpoints"): void;
}>();
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-200/50 px-4 py-2.5"
  >
    <div class="flex items-center gap-2">
      <div class="join">
        <button
          type="button"
          class="btn btn-xs join-item gap-1.5 cursor-pointer"
          :class="activeTool === 'studio' ? 'btn-primary' : 'btn-ghost'"
          @click="emit('set-tool', 'studio')"
        >
          <Sliders class="h-3.5 w-3.5" />
          <span>Block Studio EQ</span>
        </button>
        <button
          type="button"
          class="btn btn-xs join-item gap-1.5 cursor-pointer"
          :class="activeTool === 'royale' ? 'btn-primary' : 'btn-ghost'"
          @click="emit('set-tool', 'royale')"
        >
          <Trophy class="h-3.5 w-3.5" />
          <span>LoRA Royale</span>
        </button>
        <button
          type="button"
          class="btn btn-xs join-item gap-1.5 cursor-pointer"
          :class="activeTool === 'profiler' ? 'btn-primary' : 'btn-ghost'"
          @click="emit('set-tool', 'profiler')"
        >
          <Activity class="h-3.5 w-3.5" />
          <span>Block Profiler</span>
        </button>
        <button
          type="button"
          class="btn btn-xs join-item gap-1.5 cursor-pointer"
          :class="activeTool === 'metadata' ? 'btn-primary' : 'btn-ghost'"
          @click="emit('set-tool', 'metadata')"
        >
          <FileCode2 class="h-3.5 w-3.5" />
          <span>Safetensors Metadata</span>
        </button>
      </div>
    </div>

    <!-- Target LoRA Checkpoint Selector -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium text-base-content/60">Target LoRA:</span>
      <select
        :value="selectedLoraPath"
        class="select select-xs select-bordered bg-base-300/70 font-mono text-xs min-w-72"
        @change="emit('select-lora', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="ckpt in checkpoints" :key="ckpt.path" :value="ckpt.path">
          {{ ckpt.run ? `[${ckpt.run}] ` : "" }}{{ ckpt.name }}
        </option>
      </select>
      <a
        v-if="selectedCheckpoint"
        :href="downloadUrl(selectedCheckpoint.path)"
        class="btn btn-xs btn-ghost border border-base-300"
        title="Download .safetensors"
      >
        <Download class="h-3.5 w-3.5" />
      </a>
      <button
        type="button"
        class="btn btn-xs btn-ghost cursor-pointer"
        title="Refresh checkpoints"
        @click="emit('refresh-checkpoints')"
      >
        <RefreshCw class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
