<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle2, Copy, History, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type LiveRunResponse } from "@shared/types";
import { BaseButton } from "@/components/common";

const props = defineProps<{
  run: LiveRunResponse;
}>();

const emit = defineEmits<{
  (
    e: "clone",
    run: {
      family: string;
      image_folder?: string;
      values?: Record<string, unknown>;
      lora: string;
    },
  ): void;
  (e: "dismiss"): void;
  (e: "view-history"): void;
}>();

function formatDuration(sec?: number | null): string {
  if (!sec || isNaN(sec) || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const completedDurationText = computed(() => {
  if (!props.run.started_at || !props.run.ended_at) return "";
  return formatDuration(props.run.ended_at - props.run.started_at);
});

const completedArtifactPath = computed(() => {
  if (!props.run.lora) return "";
  const dir = props.run.output_dir || "/workspace/output_loras";
  return `${dir}/${props.run.lora}.safetensors`;
});

async function copyPath(text: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied artifact path to clipboard");
  } catch {
    toast.info(text);
  }
}
</script>

<template>
  <section class="rounded-xl border border-success/30 bg-success/5 p-4 shadow-xs space-y-3">
    <!-- Top Row: Completed status badge, LoRA name, duration, and post-run CTAs -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-success/20 pb-3">
      <div class="flex items-center gap-2 flex-wrap min-w-0">
        <span
          class="rounded bg-success/15 border border-success/30 px-2 py-0.5 text-xs font-semibold text-success flex items-center gap-1.5"
        >
          <CheckCircle2 class="h-3.5 w-3.5" />
          <span>Completed</span>
        </span>
        <span class="text-sm font-bold font-mono text-base-content truncate">
          {{ run.lora }}
        </span>
        <span class="badge badge-sm badge-neutral border-hairline font-mono text-[11px]">
          {{ run.family }}
        </span>
        <span v-if="completedDurationText" class="text-xs text-muted font-mono">
          Ran for <strong class="text-base-content">{{ completedDurationText }}</strong>
        </span>
      </div>

      <!-- Post-Run Action Buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <BaseButton
          size="compact"
          variant="ghost"
          title="Load these settings into Composer to train further or adapt"
          @click="
            emit('clone', {
              lora: run.lora,
              family: run.family,
              image_folder: run.image_folder,
              values: run.values,
            })
          "
        >
          <template #icon-left><Copy class="h-3.5 w-3.5 text-primary" /></template>
          <span>Clone to Composer</span>
        </BaseButton>

        <BaseButton
          size="compact"
          variant="ghost"
          title="View in History"
          @click="emit('view-history')"
        >
          <template #icon-left><History class="h-3.5 w-3.5" /></template>
          <span>History</span>
        </BaseButton>

        <BaseButton
          size="compact"
          variant="ghost"
          title="Dismiss completed summary and return to standby"
          @click="emit('dismiss')"
        >
          <template #icon-left><X class="h-3.5 w-3.5" /></template>
          <span>Dismiss</span>
        </BaseButton>
      </div>
    </div>

    <!-- Bottom Row: Metrics & Output Artifact Path -->
    <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-3 font-mono text-[11px] text-muted flex-wrap">
        <span v-if="run.progress">
          Steps:
          <strong class="text-base-content"
            >{{ run.progress.step }} / {{ run.progress.total_steps }}</strong
          >
          ({{ run.progress.epoch }} epochs)
        </span>
        <span v-if="run.progress?.loss">
          · Final Loss: <strong class="text-primary">{{ run.progress.loss }}</strong>
        </span>
        <span v-if="run.image_folder">
          · Dataset: <strong class="text-base-content">{{ run.image_folder }}</strong>
        </span>
      </div>

      <!-- Artifact Path Copy Button -->
      <div
        v-if="completedArtifactPath"
        class="flex items-center gap-1.5 font-mono text-[11px] bg-base-200/80 border border-hairline rounded px-2 py-0.5 max-w-md truncate"
      >
        <span class="text-muted shrink-0">Artifact:</span>
        <span class="text-base-content truncate">{{ completedArtifactPath }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-xs h-5 min-h-0 px-1 hover:text-primary shrink-0 cursor-pointer"
          title="Copy artifact path"
          @click="copyPath(completedArtifactPath)"
        >
          <Copy class="h-3 w-3" />
        </button>
      </div>
    </div>
  </section>
</template>
