<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { type LossDataPoint } from "@shared/types";
import BaseToggle from "@/components/common/BaseToggle.vue";
import { formatLearnRate } from "@/utils";

const props = defineProps<{
  points: LossDataPoint[];
  totalSteps?: number;
  totalEpochs?: number;
}>();

const emit = defineEmits<{
  hoverEpoch: [epoch: number | null];
}>();

const showSmooth = ref<boolean>(true);
const smoothing = ref<number>(0.65);
const logScale = ref<boolean>(false);
const clipOutliers = ref<boolean>(true);
const showLr = ref<boolean>(true);
const hoverIndex = ref<number | null>(null);

const containerRef = ref<HTMLDivElement | null>(null);
const chartWidth = ref<number>(800);
const height = 240;
const pad = { top: 18, right: 36, bottom: 32, left: 56 };
const plotW = computed(() => Math.max(100, chartWidth.value - pad.left - pad.right));
const plotH = height - pad.top - pad.bottom;

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    const initialW = containerRef.value.clientWidth;
    if (initialW > 100) {
      chartWidth.value = initialW;
    }
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 100) {
          chartWidth.value = Math.round(w);
        }
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

const smoothedSeries = computed<number[]>(() => {
  const pts = props.points;
  if (pts.length === 0) return [];
  const alpha = 1 - Math.min(0.95, Math.max(0, smoothing.value));
  const out: number[] = [];
  let ema = pts[0]?.loss ?? 0;
  for (const pt of pts) {
    ema = alpha * pt.loss + (1 - alpha) * ema;
    out.push(ema);
  }
  return out;
});

const bounds = computed(() => {
  const pts = props.points;
  if (pts.length === 0) {
    return { minStep: 0, maxStep: 100, minLoss: 0, maxLoss: 1 };
  }
  const steps = pts.map((p) => p.step);
  const minStep = Math.min(...steps);
  const maxStep = Math.max(minStep + 1, ...steps);

  let losses = pts.map((p) => Math.max(1e-6, p.loss));
  if (clipOutliers.value && losses.length > 12) {
    const sorted = losses.toSorted((a, b) => a - b);
    const p97 = sorted[Math.floor(sorted.length * 0.97)] ?? sorted[sorted.length - 1] ?? 1;
    losses = losses.map((v) => Math.min(v, p97 * 1.15));
  }

  const minLoss = Math.min(...losses);
  const maxLoss = Math.max(minLoss * 1.05 + 1e-5, ...losses);
  return { minStep, maxStep, minLoss, maxLoss };
});

function xForStep(step: number): number {
  const { minStep, maxStep } = bounds.value;
  return pad.left + ((step - minStep) / (maxStep - minStep)) * plotW.value;
}

function yForLoss(lossVal: number): number {
  const { minLoss, maxLoss } = bounds.value;
  const clamped = Math.max(minLoss, Math.min(maxLoss, Math.max(1e-6, lossVal)));
  if (logScale.value && minLoss > 0) {
    const lMin = Math.log10(minLoss);
    const lMax = Math.log10(maxLoss);
    const ratio = (Math.log10(clamped) - lMin) / Math.max(1e-6, lMax - lMin);
    return pad.top + (1 - ratio) * plotH;
  }
  const ratio = (clamped - minLoss) / Math.max(1e-6, maxLoss - minLoss);
  return pad.top + (1 - ratio) * plotH;
}

const rawPath = computed(() => {
  const pts = props.points;
  if (pts.length < 2) return "";
  const maxSegments = Math.max(400, Math.floor(chartWidth.value));
  const stride = Math.max(1, Math.floor(pts.length / maxSegments));
  const cmds: string[] = [];
  for (let i = 0; i < pts.length; i += stride) {
    const pt = pts[i];
    if (!pt) continue;
    const x = xForStep(pt.step).toFixed(1);
    const y = yForLoss(pt.loss).toFixed(1);
    cmds.push(`${cmds.length === 0 ? "M" : "L"}${x},${y}`);
  }
  return cmds.join(" ");
});

const smoothPath = computed(() => {
  const pts = props.points;
  const sm = smoothedSeries.value;
  if (pts.length < 2) return "";
  const maxSegments = Math.max(400, Math.floor(chartWidth.value));
  const stride = Math.max(1, Math.floor(pts.length / maxSegments));
  const cmds: string[] = [];
  for (let i = 0; i < pts.length; i += stride) {
    const pt = pts[i];
    const sVal = sm[i];
    if (!pt || sVal === undefined) continue;
    const x = xForStep(pt.step).toFixed(1);
    const y = yForLoss(sVal).toFixed(1);
    cmds.push(`${cmds.length === 0 ? "M" : "L"}${x},${y}`);
  }
  return cmds.join(" ");
});

const bestSmoothedMarker = computed(() => {
  const pts = props.points;
  if (pts.length === 0) return null;
  const sm = showSmooth.value ? smoothedSeries.value : pts.map((p) => p.loss);
  if (sm.length === 0) return null;
  let bestIdx = 0;
  for (let i = 1; i < sm.length; i++) {
    if ((sm[i] ?? Infinity) < (sm[bestIdx] ?? Infinity)) {
      bestIdx = i;
    }
  }
  const pt = pts[bestIdx];
  const val = sm[bestIdx];
  if (!pt || val === undefined) return null;
  return {
    x: xForStep(pt.step),
    y: yForLoss(val),
    step: pt.step,
    epoch: pt.epoch,
    loss: val,
    isEma: showSmooth.value,
  };
});

const epochTicks = computed(() => {
  const pts = props.points;
  if (pts.length === 0) return [];
  const seen = new Set<number>();
  const ticks: Array<{ epoch: number; x: number; step: number }> = [];
  for (const pt of pts) {
    if (typeof pt.epoch === "number" && pt.epoch > 0 && !seen.has(pt.epoch)) {
      seen.add(pt.epoch);
      ticks.push({
        epoch: pt.epoch,
        step: pt.step,
        x: xForStep(pt.step),
      });
    }
  }
  return ticks;
});

const yTicks = computed(() => {
  const { minLoss, maxLoss } = bounds.value;
  return [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minLoss + (maxLoss - minLoss) * (1 - t);
    return {
      y: pad.top + t * plotH,
      label: val.toFixed(4),
    };
  });
});

const hoveredPoint = computed(() => {
  if (hoverIndex.value === null) return null;
  const pt = props.points[hoverIndex.value];
  const sm = smoothedSeries.value[hoverIndex.value];
  if (!pt) return null;
  return {
    ...pt,
    smoothed: sm ?? pt.loss,
    x: xForStep(pt.step),
    y: yForLoss(sm ?? pt.loss),
  };
});

function onMouseMove(ev: MouseEvent): void {
  const svg = ev.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const relX = ((ev.clientX - rect.left) / rect.width) * chartWidth.value;
  if (relX < pad.left || relX > chartWidth.value - pad.right || props.points.length === 0) {
    hoverIndex.value = null;
    emit("hoverEpoch", null);
    return;
  }
  const ratio = (relX - pad.left) / plotW.value;
  const idx = Math.min(
    props.points.length - 1,
    Math.max(0, Math.round(ratio * (props.points.length - 1))),
  );
  hoverIndex.value = idx;
  const ep = props.points[idx]?.epoch ?? null;
  emit("hoverEpoch", ep);
}

function onMouseLeave(): void {
  hoverIndex.value = null;
  emit("hoverEpoch", null);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Chart Control Strip -->
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div class="flex items-center gap-3">
        <BaseToggle v-model="showSmooth" size="compact" label="Smooth" />

        <div v-if="showSmooth" class="flex items-center gap-2 pl-0.5">
          <input
            v-model.number="smoothing"
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            class="chart-slider"
            title="EMA smoothing factor (0 = raw, 0.95 = heavy EMA)"
          />
          <span class="font-mono-num w-7 text-[11px] text-muted">
            {{ smoothing.toFixed(2) }}
          </span>
        </div>

        <BaseToggle v-model="logScale" size="compact" label="Log scale" />
        <BaseToggle v-model="clipOutliers" size="compact" label="Clip spikes" />
        <BaseToggle v-model="showLr" size="compact" label="LR marker" />
      </div>

      <!-- Lowest Smoothed Loss Pill -->
      <div
        v-if="bestSmoothedMarker"
        class="font-mono-num flex items-center gap-2 text-[11px] text-subtle"
      >
        <span class="inline-flex items-center gap-1 text-success">
          <span class="h-2 w-2 rounded-full bg-success" />
          {{ bestSmoothedMarker.isEma ? "Lowest EMA:" : "Lowest Loss:" }}
          <strong>{{ bestSmoothedMarker.loss.toFixed(4) }}</strong>
          at step {{ bestSmoothedMarker.step }}
          <template v-if="bestSmoothedMarker.epoch"> (ep {{ bestSmoothedMarker.epoch }}) </template>
        </span>
      </div>
    </div>

    <!-- Interactive SVG Chart Surface -->
    <div
      ref="containerRef"
      class="relative w-full overflow-hidden rounded-lg border border-hairline bg-base-100"
    >
      <svg
        :viewBox="`0 0 ${chartWidth} ${height}`"
        preserveAspectRatio="none"
        class="block h-60 w-full cursor-crosshair select-none"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
      >
        <!-- Horizontal Grid Lines & Y-Axis Labels -->
        <g v-for="(tick, idx) in yTicks" :key="idx">
          <line
            :x1="pad.left"
            :x2="chartWidth - pad.right"
            :y1="tick.y"
            :y2="tick.y"
            stroke="rgba(255,255,255,0.05)"
            stroke-width="1"
          />
          <text
            :x="pad.left - 8"
            :y="tick.y + 4"
            text-anchor="end"
            fill="#7d828c"
            font-family="var(--font-mono)"
            font-size="12"
          >
            {{ tick.label }}
          </text>
        </g>

        <!-- Vertical Epoch Boundary Lines -->
        <g v-for="ep in epochTicks" :key="ep.epoch">
          <line
            :x1="ep.x"
            :x2="ep.x"
            :y1="pad.top"
            :y2="height - pad.bottom"
            stroke="rgba(255,255,255,0.06)"
            stroke-dasharray="2,3"
          />
          <text
            :x="ep.x"
            :y="height - 10"
            text-anchor="middle"
            fill="#7d828c"
            font-family="var(--font-mono)"
            font-size="12"
          >
            e{{ ep.epoch }}
          </text>
        </g>

        <!-- Raw Step Loss Path -->
        <path
          v-if="rawPath"
          :d="rawPath"
          fill="none"
          :stroke="showSmooth ? 'var(--color-chart-raw)' : 'var(--color-chart-smooth)'"
          :stroke-width="showSmooth ? 1 : 1.5"
          :opacity="showSmooth ? 0.75 : 1"
        />

        <!-- Smoothed EMA Loss Path -->
        <path
          v-if="showSmooth && smoothPath"
          :d="smoothPath"
          fill="none"
          stroke="var(--color-chart-smooth)"
          stroke-width="2"
        />

        <!-- Lowest Smoothed Loss Dot -->
        <circle
          v-if="bestSmoothedMarker"
          :cx="bestSmoothedMarker.x"
          :cy="bestSmoothedMarker.y"
          r="4"
          fill="var(--color-chart-best)"
          stroke="#08090a"
          stroke-width="1.5"
        />

        <!-- Hover Crosshair & Point -->
        <g v-if="hoveredPoint">
          <line
            :x1="hoveredPoint.x"
            :x2="hoveredPoint.x"
            :y1="pad.top"
            :y2="height - pad.bottom"
            stroke="rgba(255,255,255,0.28)"
            stroke-width="1"
          />
          <circle
            :cx="hoveredPoint.x"
            :cy="hoveredPoint.y"
            r="4"
            fill="var(--color-primary)"
            stroke="#ffffff"
            stroke-width="1.5"
          />
        </g>
      </svg>

      <!-- Floating Hover Readout Pill -->
      <div
        v-if="hoveredPoint"
        class="font-mono-num pointer-events-none absolute top-2 left-16 flex items-center gap-3 rounded border border-hairline-strong bg-base-300/95 px-2.5 py-1 text-[11px]"
      >
        <span>
          Step <strong class="text-base-content">{{ hoveredPoint.step }}</strong>
        </span>
        <span v-if="hoveredPoint.epoch">
          Epoch <strong class="text-base-content">{{ hoveredPoint.epoch }}</strong>
        </span>
        <span>
          Raw <strong class="text-subtle">{{ hoveredPoint.loss.toFixed(4) }}</strong>
        </span>
        <span v-if="showSmooth">
          EMA
          <strong class="text-primary">{{ hoveredPoint.smoothed.toFixed(4) }}</strong>
        </span>
        <span v-if="showLr && hoveredPoint.lr">
          LR <strong class="text-warning">{{ formatLearnRate(hoveredPoint.lr) }}</strong>
        </span>
      </div>

      <!-- Empty State -->
      <div
        v-if="points.length === 0"
        class="absolute inset-0 flex items-center justify-center text-xs text-muted"
      >
        No loss steps recorded yet.
      </div>
    </div>
  </div>
</template>
