<script setup lang="ts">
import { AlertTriangle, CheckCircle2, X } from "lucide-vue-next";
import { BaseButton, BaseModal } from "@/components/common";

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
  <BaseModal
    :open="open"
    title="Dismiss Completed Run?"
    subtitle="Clear the active monitor and return to standby."
    max-width="md"
    @close="emit('close')"
  >
    <template #icon>
      <div
        class="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 border border-warning/30 text-warning shrink-0"
      >
        <AlertTriangle class="h-4 w-4" />
      </div>
    </template>

    <div class="space-y-2.5 text-xs text-subtle leading-relaxed">
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
          All <strong>.safetensors</strong> model weights, checkpoints, and execution history remain
          permanently stored in <code class="text-xs font-mono">/workspace/output_loras</code> and
          the <strong>History</strong> tab.
        </p>
      </div>
      <p class="text-[11px] text-muted">
        This will reset the active loss curves, logs, checkpoints, and sample previews from the
        monitor screen so you can start clean.
      </p>
    </div>

    <template #footer>
      <div />
      <div class="flex items-center gap-2">
        <BaseButton variant="ghost" @click="emit('close')">
          <span>Cancel</span>
        </BaseButton>
        <BaseButton variant="warning" @click="emit('confirm')">
          <template #icon-left><X class="h-3.5 w-3.5" /></template>
          <span>Dismiss &amp; Clear Monitor</span>
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
