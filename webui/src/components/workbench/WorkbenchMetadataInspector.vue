<script setup lang="ts">
import BaseButton from "@/components/common/BaseButton.vue";

defineProps<{
  metadataJson: Record<string, unknown> | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "reload"): void;
}>();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl rounded-lg border border-base-300 bg-base-200 p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-base-content">
          Safetensors Header Metadata (<code class="text-xs font-mono">__metadata__</code>)
        </h2>
        <BaseButton size="compact" variant="ghost" :disabled="loading" @click="emit('reload')">
          Reload Header
        </BaseButton>
      </div>
      <div v-if="loading" class="text-xs text-base-content/50">Reading safetensors header...</div>
      <pre
        v-else-if="metadataJson"
        class="max-h-[65vh] overflow-auto rounded border border-base-300 bg-base-300/70 p-3 font-mono text-xs text-base-content/85"
        >{{ JSON.stringify(metadataJson, null, 2) }}</pre>
    </div>
  </div>
</template>
