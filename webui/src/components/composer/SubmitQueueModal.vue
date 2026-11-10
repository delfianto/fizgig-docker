<script setup lang="ts">
import { CheckCircle2, Clock, Cpu, Database, ListPlus, Loader2, Sparkles } from "lucide-vue-next";
import { BaseButton, BaseModal } from "@/components/common";

defineProps<{
  open: boolean;
  loraName: string;
  family: string;
  familyLabel?: string;
  gpuName?: string;
  recipeTitle: string;
  datasetName: string;
  datasetCount: number;
  epochs: number;
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "close"): void;
}>();
</script>

<template>
  <BaseModal
    :open="open"
    title="Submit Job to Queue"
    subtitle="Review job configuration before enqueuing for training."
    max-width="lg"
    :prevent-close="Boolean(isSubmitting)"
    @close="emit('close')"
  >
    <template #icon>
      <div
        class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary shrink-0"
      >
        <ListPlus class="h-4 w-4" />
      </div>
    </template>

    <div class="space-y-3.5">
      <div class="rounded-lg border border-hairline bg-base-200 p-3.5 space-y-2.5">
        <div class="flex items-center justify-between border-b border-hairline/60 pb-2">
          <span class="text-xs text-subtle">LoRA Job Identifier</span>
          <span class="font-mono text-xs font-bold text-primary truncate max-w-60">
            {{ loraName || "Unnamed LoRA" }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="flex items-center gap-1.5 text-subtle">
            <Cpu class="h-3.5 w-3.5 text-primary shrink-0" />
            <span class="truncate font-semibold">{{ gpuName || familyLabel || family }}</span>
          </div>
          <div class="flex items-center gap-1.5 text-subtle">
            <Sparkles class="h-3.5 w-3.5 text-secondary shrink-0" />
            <span class="truncate">{{ recipeTitle }}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs border-t border-hairline/60 pt-2">
          <div class="flex items-center gap-1.5 text-subtle">
            <Database class="h-3.5 w-3.5 text-info shrink-0" />
            <span class="truncate font-mono">{{ datasetName }}</span>
          </div>
          <div class="flex items-center gap-1.5 text-subtle">
            <Clock class="h-3.5 w-3.5 text-warning shrink-0" />
            <span class="font-mono font-medium text-base-content">{{ epochs }} epochs</span>
          </div>
        </div>
      </div>

      <div
        class="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success"
      >
        <CheckCircle2 class="h-4 w-4 shrink-0" />
        <span
          >Dataset verified: <strong>{{ datasetCount }}</strong> images, 100% tagged &amp;
          ready.</span
        >
      </div>

      <p class="text-[11px] text-muted leading-relaxed">
        The job will be placed in the background training queue (FIFO order). If training is
        currently active, it will start automatically once the GPU becomes available.
      </p>
    </div>

    <template #footer>
      <div />
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" :disabled="isSubmitting" @click="emit('close')">
          <span>Cancel</span>
        </BaseButton>
        <BaseButton variant="primary" :disabled="isSubmitting" @click="emit('confirm')">
          <template #icon-left>
            <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
            <ListPlus v-else class="h-4 w-4" />
          </template>
          <span>{{ isSubmitting ? "Submitting..." : "Submit Job to Queue" }}</span>
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
