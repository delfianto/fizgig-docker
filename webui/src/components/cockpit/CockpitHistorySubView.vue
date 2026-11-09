<script setup lang="ts">
import { computed, ref } from "vue";
import { Activity, Copy } from "lucide-vue-next";
import { type HistoricalRun } from "@shared/types";

const props = defineProps<{
  historicalRuns: HistoricalRun[];
}>();

const emit = defineEmits<{
  (e: "inspect", item: HistoricalRun): void;
  (e: "clone", item: HistoricalRun): void;
}>();

const historySearch = ref("");

const filteredHistory = computed(() => {
  const q = historySearch.value.trim().toLowerCase();
  if (!q) return props.historicalRuns;
  return props.historicalRuns.filter(
    (r) =>
      r.lora.toLowerCase().includes(q) ||
      r.family.toLowerCase().includes(q) ||
      (r.image_folder && r.image_folder.toLowerCase().includes(q)),
  );
});

function renderMiniSparkline(vals?: number[]): string {
  if (!vals || vals.length < 2) return "";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1e-6, max - min);
  const w = 80;
  const h = 22;
  return vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="mx-auto max-w-6xl rounded-lg border border-hairline bg-base-300">
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-base-200 px-4 py-3"
      >
        <h2 class="text-sm font-semibold text-base-content">
          Run History ({{ filteredHistory.length }})
        </h2>
        <input
          v-model="historySearch"
          type="text"
          placeholder="Filter by LoRA name, model family, or dataset..."
          class="input input-sm w-72 border-hairline-strong bg-base-100 text-xs"
        />
      </div>

      <div class="divide-y divide-hairline text-xs">
        <div v-if="filteredHistory.length === 0" class="p-8 text-center text-xs text-muted">
          No historical runs match the search filter.
        </div>

        <div
          v-for="item in filteredHistory"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover"
        >
          <div class="flex items-center gap-3">
            <span
              class="rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase"
              :class="
                item.status === 'running'
                  ? 'bg-warning/15 text-warning'
                  : item.status === 'completed' || item.status === 'done'
                    ? 'bg-success/15 text-success'
                    : 'bg-base-200 text-subtle'
              "
            >
              {{ item.status || "saved" }}
            </span>

            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono text-sm font-semibold text-base-content">
                  {{ item.lora }}
                </span>
                <span class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                  {{ item.family_label || item.family }}
                </span>
              </div>
              <div class="mt-0.5 font-mono text-[11px] text-muted">
                Dataset: {{ item.image_folder }}
                <span v-if="item.lowest_loss">
                  · Lowest loss:
                  <strong class="text-success">
                    {{ Number(item.lowest_loss).toFixed(4) }}
                  </strong>
                  <template v-if="item.lowest_epoch"> (ep {{ item.lowest_epoch }}) </template>
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <svg
              v-if="item.loss_spark && item.loss_spark.length > 1"
              width="82"
              height="24"
              class="rounded border border-hairline bg-base-100 px-0.5"
            >
              <path
                :d="renderMiniSparkline(item.loss_spark)"
                fill="none"
                stroke="var(--color-primary)"
                stroke-width="1.5"
              />
            </svg>

            <button
              type="button"
              class="btn btn-xs btn-ghost border border-hairline bg-base-200"
              @click="emit('inspect', item)"
            >
              <Activity class="h-3.5 w-3.5 text-primary" />
              Inspect Loss &amp; Samples
            </button>

            <button
              type="button"
              class="btn btn-xs btn-ghost border border-hairline bg-base-200"
              @click="emit('clone', item)"
            >
              <Copy class="h-3.5 w-3.5" />
              Clone to Composer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
