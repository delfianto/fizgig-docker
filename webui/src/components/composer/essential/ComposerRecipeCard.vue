<script setup lang="ts">
import { Sparkles } from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";

defineProps<{
  parsedRecipe: { title: string; subtitle: string };
  currentPresetNote: string | null;
}>();

const composerStore = useComposerStore();

function formatDecimalValue(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).trim();
  if (/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(str)) {
    const num = Number(str);
    if (!Number.isNaN(num)) {
      return num.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 8 });
    }
  }
  return str;
}
</script>

<template>
  <section class="rounded-xl border border-hairline bg-base-300/80 p-2.5 space-y-1.5">
    <div class="flex items-center justify-between gap-3 border-b border-hairline pb-1">
      <div class="flex items-center gap-2 min-w-0">
        <Sparkles class="h-3.5 w-3.5 text-secondary shrink-0" />
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xs font-bold text-base-content truncate">
            Recipe: <span class="text-primary">{{ parsedRecipe.title }}</span>
          </span>
          <span
            v-if="parsedRecipe.subtitle"
            class="text-[11px] text-subtle truncate hidden sm:inline"
          >
            ({{ parsedRecipe.subtitle }})
          </span>
        </div>
      </div>
    </div>

    <!-- Compact Parameter Badges in 1 row -->
    <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      <div class="rounded-lg border border-hairline bg-base-200/60 px-2 py-1">
        <span class="text-[10px] text-muted block">Network Rank</span>
        <span class="font-mono text-xs font-bold text-base-content">
          Dim {{ composerStore.draftValues.NETWORK_DIM ?? 16 }} / Alpha
          {{ composerStore.draftValues.NETWORK_ALPHA ?? 16 }}
        </span>
      </div>

      <div class="rounded-lg border border-hairline bg-base-200/60 px-2 py-1">
        <span class="text-[10px] text-muted block">Optimizer</span>
        <span class="font-mono text-xs font-bold text-primary uppercase">
          {{ composerStore.draftValues.OPTIMIZER_TYPE || "Muon" }}
        </span>
      </div>

      <div class="rounded-lg border border-hairline bg-base-200/60 px-2 py-1">
        <span class="text-[10px] text-muted block">Learning Rate</span>
        <span class="font-mono text-xs font-bold text-warning">
          {{
            composerStore.draftValues.ADAPTIVE_LR
              ? "Adaptive"
              : formatDecimalValue(composerStore.draftValues.LEARNING_RATE || "0.0001")
          }}
        </span>
      </div>

      <div class="rounded-lg border border-hairline bg-base-200/60 px-2 py-1">
        <span class="text-[10px] text-muted block">Resolution</span>
        <span class="font-mono text-xs font-bold text-base-content">
          {{ composerStore.draftValues.DATASET_MEGAPIXELS || "1.0" }} MP
        </span>
      </div>
    </div>
  </section>
</template>
