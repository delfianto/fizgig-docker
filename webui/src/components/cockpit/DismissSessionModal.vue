<script setup lang="ts">
import { AlertTriangle, CheckCircle2, X } from "lucide-vue-next";
import { BaseButton } from "@/components/common";

defineProps<{
  open: boolean;
  loraName?: string | null;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "close"): void;
}>();
</script>

<template>
  <dialog v-if="open" class="modal modal-open">
    <div class="modal-box max-w-md border border-hairline bg-base-300 p-5 shadow-2xl">
      <div class="flex items-center gap-3 border-b border-hairline pb-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 border border-warning/30 text-warning shrink-0"
        >
          <AlertTriangle class="h-5 w-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-base-content">Dismiss Completed Run?</h3>
          <p class="text-xs text-muted">Clear the active monitor and return to standby.</p>
        </div>
      </div>

      <div class="py-4 space-y-2.5 text-xs text-subtle leading-relaxed">
        <p>
          You are about to dismiss the completed session
          <template v-if="loraName">
            for <strong class="font-mono text-base-content">{{ loraName }}</strong>
          </template>
          .
        </p>
        <div class="rounded-lg border border-hairline bg-base-200 p-3 space-y-1.5">
          <div class="flex items-center gap-1.5 text-success font-medium">
            <CheckCircle2 class="h-4 w-4 shrink-0" />
            <span>Safe action: Your weights and logs are preserved</span>
          </div>
          <p class="text-[11px] text-muted">
            All <strong>.safetensors</strong> model weights, checkpoints, and execution history
            remain permanently stored in
            <code class="text-xs font-mono">/workspace/output_loras</code> and the
            <strong>History</strong> tab.
          </p>
        </div>
        <p class="text-[11px] text-muted">
          This will reset the active loss curves, logs, checkpoints, and sample previews from the
          monitor screen so you can start clean.
        </p>
      </div>

      <div
        class="modal-action mt-2 flex items-center justify-end gap-2 border-t border-hairline pt-3"
      >
        <BaseButton variant="ghost" @click="emit('close')">
          <span>Cancel</span>
        </BaseButton>
        <BaseButton variant="warning" @click="emit('confirm')">
          <template #icon-left><X class="h-3.5 w-3.5" /></template>
          <span>Dismiss &amp; Clear Monitor</span>
        </BaseButton>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop bg-black/60" @click="emit('close')">
      <button>close</button>
    </form>
  </dialog>
</template>
