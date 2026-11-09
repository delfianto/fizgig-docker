<script setup lang="ts">
import {
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ListPlus,
  Loader2,
  Sparkles,
  X,
} from "lucide-vue-next";

defineProps<{
  open: boolean;
  loraName: string;
  family: string;
  familyLabel?: string;
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
  <dialog v-if="open" class="modal modal-open">
    <div class="modal-box max-w-lg border border-hairline bg-base-300 p-5 shadow-2xl">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-hairline pb-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary shrink-0"
          >
            <ListPlus class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-base-content">Submit Job to Queue</h3>
            <p class="text-xs text-muted">
              Review job configuration before enqueuing for training.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle text-muted hover:text-base-content"
          :disabled="isSubmitting"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Job Summary Card -->
      <div class="py-4 space-y-3.5">
        <div class="rounded-lg border border-hairline bg-base-200 p-3.5 space-y-2.5">
          <div class="flex items-center justify-between border-b border-hairline/60 pb-2">
            <span class="text-xs text-subtle">LoRA Job Identifier</span>
            <span class="font-mono text-xs font-bold text-primary truncate max-w-60">
              {{ loraName || "Unnamed LoRA" }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="flex items-center gap-1.5 text-subtle">
              <Cpu class="h-3.5 w-3.5 text-muted shrink-0" />
              <span class="truncate">{{ familyLabel || family }}</span>
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

        <!-- Dataset Verification Note -->
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

      <!-- Action Buttons -->
      <div
        class="modal-action mt-1 flex items-center justify-end gap-2 border-t border-hairline pt-3"
      >
        <button
          type="button"
          class="btn btn-sm h-8.5 rounded-lg btn-ghost border border-hairline bg-base-200 px-3.5 text-xs font-semibold cursor-pointer"
          :disabled="isSubmitting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-sm h-8.5 rounded-lg btn-primary gap-1.5 px-4 text-xs font-bold cursor-pointer shadow-md"
          :disabled="isSubmitting"
          @click="emit('confirm')"
        >
          <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
          <ListPlus v-else class="h-4 w-4" />
          <span>{{ isSubmitting ? "Submitting..." : "Submit Job to Queue" }}</span>
        </button>
      </div>
    </div>
    <form
      method="dialog"
      class="modal-backdrop bg-black/60"
      @click="!isSubmitting && emit('close')"
    >
      <button>close</button>
    </form>
  </dialog>
</template>
