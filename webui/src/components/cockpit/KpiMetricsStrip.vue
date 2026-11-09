<script setup lang="ts">
import { computed } from "vue";
import { type HistoricalRun, type LossDataPoint, type RunProgress } from "@shared/types";

const props = defineProps<{
  progress: RunProgress | null;
  inspectingHistoricalRun: HistoricalRun | null;
  lossPoints: LossDataPoint[];
  lowestLossPoint: LossDataPoint | null;
  runValues?: Record<string, unknown>;
}>();

const epochDisplay = computed(() => {
  if (props.progress) {
    return `${props.progress.epoch} / ${props.progress.total_epochs}`;
  }
  if (props.inspectingHistoricalRun) {
    const r = props.inspectingHistoricalRun;
    const cur = r.curve?.length ?? r.epoch ?? "—";
    const total = r.values?.MAX_TRAIN_EPOCHS ?? r.epochs ?? r.curve?.length ?? "—";
    return `${cur} / ${total}`;
  }
  return "—";
});

const stepDisplay = computed(() => {
  if (props.progress) {
    return `${props.progress.step} / ${props.progress.total_steps}`;
  }
  return props.lossPoints.length || "—";
});

const speedDisplay = computed(() => {
  return props.progress?.speed || "—";
});

const lossDisplay = computed(() => {
  if (props.progress?.loss) {
    return props.progress.loss;
  }
  if (props.lowestLossPoint) {
    return props.lowestLossPoint.loss.toFixed(4);
  }
  return "—";
});

const gradNormDisplay = computed(() => {
  return props.progress?.grad_norm || "—";
});

const learnRateDisplay = computed(() => {
  return (
    props.progress?.lr ||
    props.inspectingHistoricalRun?.values?.LEARNING_RATE ||
    props.runValues?.LEARNING_RATE ||
    "—"
  );
});
</script>

<template>
  <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
    <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
      <div class="text-xs font-semibold tracking-wider text-muted uppercase">Epoch</div>
      <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
        {{ epochDisplay }}
      </div>
    </div>

    <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
      <div class="text-xs font-semibold tracking-wider text-muted uppercase">Step</div>
      <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
        {{ stepDisplay }}
      </div>
    </div>

    <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
      <div class="text-xs font-semibold tracking-wider text-muted uppercase">Speed</div>
      <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
        {{ speedDisplay }}
      </div>
    </div>

    <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
      <div class="text-xs font-semibold tracking-wider text-muted uppercase">Loss</div>
      <div class="font-mono-num mt-1 text-xl font-bold text-primary">
        {{ lossDisplay }}
      </div>
    </div>

    <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
      <div class="text-xs font-semibold tracking-wider text-muted uppercase">Grad Norm</div>
      <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
        {{ gradNormDisplay }}
      </div>
    </div>

    <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
      <div class="text-xs font-semibold tracking-wider text-muted uppercase">Learn Rate</div>
      <div class="font-mono-num mt-1 text-xl font-bold text-warning">
        {{ learnRateDisplay }}
      </div>
    </div>
  </div>
</template>
