<script setup lang="ts">
import { Activity, Download, FileCode2, RefreshCw, Sliders, Trophy } from "lucide-vue-next";
import { type CheckpointItem } from "@shared/types";
import { downloadUrl } from "@/api/client";
import { BaseButton, BasePillGroup, BaseSelect } from "@/components/common";

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
    class="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-base-200 px-4 py-2"
  >
    <div class="flex items-center gap-2">
      <BasePillGroup
        :model-value="activeTool"
        :options="[
          { value: 'studio', label: 'Block Studio EQ', icon: Sliders },
          { value: 'royale', label: 'LoRA Royale', icon: Trophy },
          { value: 'profiler', label: 'Block Profiler', icon: Activity },
          { value: 'metadata', label: 'Safetensors Metadata', icon: FileCode2 },
        ]"
        @update:model-value="
          (val) => emit('set-tool', val as 'studio' | 'royale' | 'profiler' | 'metadata')
        "
      />
    </div>

    <!-- Target LoRA Checkpoint Selector -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium text-subtle">Target LoRA:</span>
      <BaseSelect
        :model-value="selectedLoraPath"
        mono
        select-class="min-w-72"
        @update:model-value="(val) => emit('select-lora', String(val))"
      >
        <option v-if="checkpoints.length === 0" value="">No saved checkpoints found</option>
        <option v-for="ckpt in checkpoints" :key="ckpt.path" :value="ckpt.path">
          {{ ckpt.run ? `[${ckpt.run}] ` : "" }}{{ ckpt.name }}
        </option>
      </BaseSelect>
      <a
        v-if="selectedCheckpoint"
        :href="downloadUrl(selectedCheckpoint.path)"
        class="btn btn-sm h-8.5 w-8.5 p-0 rounded-lg btn-ghost border border-hairline bg-base-100 hover:border-primary transition cursor-pointer flex items-center justify-center"
        title="Download .safetensors"
      >
        <Download class="h-3.5 w-3.5" />
      </a>
      <BaseButton
        size="square-default"
        variant="ghost"
        title="Refresh checkpoints"
        @click="emit('refresh-checkpoints')"
      >
        <RefreshCw class="h-3.5 w-3.5" />
      </BaseButton>
    </div>
  </div>
</template>
