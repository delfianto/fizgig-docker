<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
} from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";
import { BaseButton } from "@/components/common";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSystemStore } from "@/stores/system";

const props = defineProps<{
  isSelectedDatasetReady: boolean;
  selectedDatasetInfo?: DatasetSummary | null;
}>();

const router = useRouter();
const runStore = useRunStore();
const systemStore = useSystemStore();
const composerStore = useComposerStore();

interface GpuOption {
  index: number;
  name: string;
  vramUsedBytes: number;
  vramTotalBytes: number;
  vramFreeBytes: number;
  vramUsedGb: number;
  vramTotalGb: number;
  vramFreeGb: number;
  util: number;
  temp: number;
  power?: number;
  powerLimit?: number;
}

onMounted(async () => {
  if (!systemStore.prefs.gpus) {
    await systemStore.fetchPrefs();
  }
  const saved = String(systemStore.prefs.cuda_device ?? "").trim();
  if (saved !== "" && !Number.isNaN(Number(saved))) {
    composerStore.selectedGpuIndex = Number(saved);
  }
});

const availableGpus = computed<GpuOption[]>(() => {
  // 1. From enriched runStore.stats?.gpus (real-time telemetry from nvidia-smi)
  const statGpus = runStore.stats?.gpus;
  if (Array.isArray(statGpus) && statGpus.length > 0) {
    return statGpus.map((g) => {
      const used = g.vram[0] || 0;
      const total = g.vram[1] || 1;
      const free = Math.max(0, total - used);
      return {
        index: g.index,
        name: g.name.replace(/^NVIDIA GeForce\s+/, ""),
        vramUsedBytes: used,
        vramTotalBytes: total,
        vramFreeBytes: free,
        vramUsedGb: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10,
        vramTotalGb: Math.round((total / (1024 * 1024 * 1024)) * 10) / 10,
        vramFreeGb: Math.round((free / (1024 * 1024 * 1024)) * 10) / 10,
        util: g.util ?? 0,
        temp: g.temp ?? 0,
        power: g.power,
        powerLimit: g.power_limit,
      };
    });
  }

  // 2. Fallback to systemStore.prefs?.gpus
  const prefGpus = (
    systemStore.prefs as {
      gpus?: Array<{
        index: number;
        name: string;
        total_gb: number;
        used_gb: number;
        util?: number;
        temp?: number;
      }>;
    }
  ).gpus;
  if (Array.isArray(prefGpus) && prefGpus.length > 0) {
    return prefGpus.map((g) => {
      const total = (g.total_gb || 16) * 1024 * 1024 * 1024;
      const used = (g.used_gb || 0) * 1024 * 1024 * 1024;
      const free = Math.max(0, total - used);
      return {
        index: g.index,
        name: g.name.replace(/^NVIDIA GeForce\s+/, ""),
        vramUsedBytes: used,
        vramTotalBytes: total,
        vramFreeBytes: free,
        vramUsedGb: Math.round((g.used_gb || 0) * 10) / 10,
        vramTotalGb: Math.round((g.total_gb || 16) * 10) / 10,
        vramFreeGb: Math.round(((g.total_gb || 16) - (g.used_gb || 0)) * 10) / 10,
        util: g.util ?? 0,
        temp: g.temp ?? 0,
      };
    });
  }

  // 3. Fallback to primary GPU
  const used = runStore.stats?.vram?.[0] || 0;
  const total = runStore.stats?.vram?.[1] || 16 * 1024 * 1024 * 1024;
  const free = Math.max(0, total - used);
  return [
    {
      index: 0,
      name: (runStore.stats?.device_name || "NVIDIA RTX 4080").replace(/^NVIDIA GeForce\s+/, ""),
      vramUsedBytes: used,
      vramTotalBytes: total,
      vramFreeBytes: free,
      vramUsedGb: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10,
      vramTotalGb: Math.round((total / (1024 * 1024 * 1024)) * 10) / 10,
      vramFreeGb: Math.round((free / (1024 * 1024 * 1024)) * 10) / 10,
      util: runStore.stats?.gpu_util ?? 0,
      temp: runStore.stats?.gpu_temp ?? 0,
    },
  ];
});

const selectedGpu = computed(() => {
  const target = availableGpus.value.find((g) => g.index === composerStore.selectedGpuIndex);
  return target || availableGpus.value[0] || null;
});

const estVramGb = computed(() => composerStore.estimatedVramGb);

const vramStatus = computed(() => {
  if (!selectedGpu.value) {
    return { ok: true, headroomGb: 4.0, isOomRisk: false, isSevereOom: false };
  }
  const total = selectedGpu.value.vramTotalGb;
  const free = selectedGpu.value.vramFreeGb;
  const required = estVramGb.value;

  // Headroom against total VRAM minus a 0.8GB system safety margin
  const usableTotal = Math.max(0, total - 0.8);
  const headroomVsTotal = Math.round((usableTotal - required) * 10) / 10;
  const headroomVsFree = Math.round((free - required) * 10) / 10;

  // Severe OOM: required exceeds physical total capacity of the card
  const isSevereOom = required > usableTotal;
  // OOM Risk: required exceeds currently free memory, though card total might fit if unloaded
  const isOomRisk = required > free || isSevereOom;

  return {
    ok: !isOomRisk,
    headroomGb: isOomRisk ? headroomVsFree : headroomVsTotal,
    isOomRisk,
    isSevereOom,
  };
});

const overallReadiness = computed(() => {
  const datasetReady = props.isSelectedDatasetReady;
  const vramReady = vramStatus.value.ok;

  if (datasetReady && vramReady) {
    return {
      status: "ready",
      label: "Ready to Train",
      badgeClass: "badge-success",
      cardBorder: "border-primary/30 bg-primary/5",
    };
  }

  if (!datasetReady && !vramReady) {
    return {
      status: "blocked",
      label: "Blocked (2 Issues)",
      badgeClass: "badge-error",
      cardBorder: "border-error/30 bg-error/5",
    };
  }

  if (!datasetReady) {
    return {
      status: "warning-dataset",
      label: "Incomplete Dataset",
      badgeClass: "badge-warning",
      cardBorder: "border-warning/30 bg-warning/5",
    };
  }

  return {
    status: "warning-vram",
    label: vramStatus.value.isSevereOom ? "OOM Inevitable" : "High OOM Risk",
    badgeClass: "badge-warning",
    cardBorder: "border-warning/30 bg-warning/5",
  };
});
</script>

<template>
  <section
    class="rounded-xl border p-2.5 space-y-2 transition-colors"
    :class="overallReadiness.cardBorder"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-hairline/60 pb-1.5">
      <div class="flex items-center gap-2">
        <ShieldCheck v-if="overallReadiness.status === 'ready'" class="h-4 w-4 text-primary" />
        <ShieldAlert v-else class="h-4 w-4 text-warning" />
        <h3 class="text-xs font-bold uppercase tracking-wider text-base-content">
          Compute &amp; Readiness
        </h3>
      </div>
      <span class="badge badge-sm font-semibold text-[11px]" :class="overallReadiness.badgeClass">
        {{ overallReadiness.label }}
      </span>
    </div>

    <!-- GPU Selection List with Radio Buttons -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <label class="text-xs font-semibold text-subtle"> Target Training GPU: </label>
        <span class="text-[11px] font-mono text-muted">
          {{ availableGpus.length }} device(s) detected
        </span>
      </div>

      <div class="space-y-1">
        <div
          v-for="gpu in availableGpus"
          :key="gpu.index"
          class="flex items-center justify-between gap-2.5 rounded-lg border p-2 transition cursor-pointer select-none"
          :class="
            composerStore.selectedGpuIndex === gpu.index
              ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
              : 'border-hairline bg-base-200/50 text-subtle hover:bg-base-200 hover:border-hairline-strong'
          "
          @click="composerStore.setSelectedGpu(gpu.index)"
        >
          <!-- Left: Radio & Identity -->
          <div class="flex items-center gap-2 min-w-0">
            <input
              type="radio"
              name="selected_gpu"
              :checked="composerStore.selectedGpuIndex === gpu.index"
              class="radio radio-primary radio-xs pointer-events-none shrink-0"
            />
            <div
              class="flex h-6 w-6 items-center justify-center rounded bg-base-300 shrink-0"
              :class="composerStore.selectedGpuIndex === gpu.index ? 'text-primary' : 'text-subtle'"
            >
              <Cpu class="h-3.5 w-3.5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-xs text-base-content truncate">
                  {{ gpu.name }}
                </span>
                <span
                  class="badge badge-xs font-mono px-1 py-0 h-4 text-[9px]"
                  :class="
                    composerStore.selectedGpuIndex === gpu.index ? 'badge-primary' : 'badge-neutral'
                  "
                >
                  GPU {{ gpu.index }}
                </span>
                <span
                  v-if="composerStore.selectedGpuIndex === gpu.index"
                  class="badge badge-xs badge-success font-mono text-[9px] px-1 py-0 h-4"
                >
                  Active
                </span>
              </div>
              <span class="font-mono text-[10px] text-muted block truncate">
                {{ gpu.vramUsedGb }} / {{ gpu.vramTotalGb }} GB used ({{ gpu.vramFreeGb }} GB free)
              </span>
            </div>
          </div>

          <!-- Right: Telemetry & Memory Bar -->
          <div class="flex flex-col items-end gap-1 shrink-0">
            <div class="flex items-center gap-1.5 font-mono text-[10px] text-base-content">
              <span>{{ gpu.util }}% load</span>
              <span class="text-muted">·</span>
              <div class="flex items-center gap-0.5">
                <Thermometer class="h-2.5 w-2.5 text-muted" />
                <span>{{ gpu.temp }}°C</span>
              </div>
            </div>
            <!-- Visual VRAM Bar -->
            <div class="w-20 h-1.5 bg-base-300 rounded-full overflow-hidden">
              <div
                class="h-full transition-all"
                :class="
                  gpu.vramUsedBytes / gpu.vramTotalBytes > 0.85
                    ? 'bg-error'
                    : gpu.vramUsedBytes / gpu.vramTotalBytes > 0.6
                      ? 'bg-warning'
                      : 'bg-primary'
                "
                :style="{
                  width: `${Math.min(100, Math.round((gpu.vramUsedBytes / gpu.vramTotalBytes) * 100))}%`,
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estimated VRAM Telemetry Strip -->
    <div
      class="flex items-center justify-between rounded-lg border border-hairline bg-base-300/70 px-2.5 py-1.5 text-xs font-mono"
    >
      <div class="flex items-center gap-1.5 text-subtle truncate">
        <span class="text-[11px] text-muted">Est. Job VRAM:</span>
        <span class="font-bold text-base-content text-[11px]">~{{ estVramGb }} GB</span>
      </div>
      <div class="flex items-center gap-1.5 text-[11px]">
        <span class="text-muted">Headroom:</span>
        <span
          class="font-bold font-mono"
          :class="vramStatus.ok ? 'text-success' : 'text-error animate-pulse'"
        >
          {{ vramStatus.headroomGb >= 0 ? `+${vramStatus.headroomGb}` : vramStatus.headroomGb }} GB
        </span>
      </div>
    </div>

    <!-- Preflight In-Card Warnings / Readiness Container -->
    <div class="space-y-1.5 pt-0.5">
      <!-- 1. Dataset Incomplete Warning Callout -->
      <div
        v-if="!isSelectedDatasetReady"
        class="flex items-start justify-between gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning"
      >
        <div class="flex items-start gap-2 min-w-0">
          <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <div class="space-y-0.5 min-w-0">
            <div class="font-bold tracking-tight">Dataset Incomplete</div>
            <p class="text-[11px] text-warning/90 leading-relaxed">
              <span v-if="selectedDatasetInfo">
                Captions incomplete:
                <strong>
                  {{ selectedDatasetInfo.captioned ?? 0 }} / {{ selectedDatasetInfo.count }}
                </strong>
                tagged. 100% caption coverage required before launch.
              </span>
              <span v-else>
                No valid training dataset selected. Please choose a folder with tagged images.
              </span>
            </p>
          </div>
        </div>
        <BaseButton
          variant="warning"
          size="xs"
          class="shrink-0 font-medium"
          @click="router.push('/datasets')"
        >
          <span>Caption Studio</span>
          <template #icon-right>
            <ArrowRight class="h-2.5 w-2.5" />
          </template>
        </BaseButton>
      </div>

      <!-- 2. Insufficient VRAM / OOM Risk Warning Callout -->
      <div
        v-if="!vramStatus.ok"
        class="flex items-start justify-between gap-2.5 rounded-lg border p-2 text-xs"
        :class="
          vramStatus.isSevereOom
            ? 'border-error/40 bg-error/10 text-error'
            : 'border-warning/40 bg-warning/10 text-warning'
        "
      >
        <div class="flex items-start gap-2 min-w-0">
          <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" />
          <div class="space-y-0.5 min-w-0">
            <div class="font-bold tracking-tight">
              {{
                vramStatus.isSevereOom
                  ? "Insufficient Physical VRAM (OOM Inevitable)"
                  : "Insufficient Free VRAM (High OOM Risk)"
              }}
            </div>
            <p class="text-[11px] leading-relaxed opacity-90">
              Estimated job requirement is <strong>~{{ estVramGb }} GB</strong>, but
              {{ selectedGpu?.name }} only has
              <strong>{{ selectedGpu?.vramFreeGb }} GB free</strong> (out of
              {{ selectedGpu?.vramTotalGb }} GB total).
              <span v-if="availableGpus.length > 1">
                Switch to a GPU with more headroom above, or reduce network rank / resolution.
              </span>
              <span v-else>
                Reduce dataset resolution or network rank to prevent CUDA Out Of Memory.
              </span>
            </p>
          </div>
        </div>
      </div>

      <!-- 3. Preflight All-Clear Success Banner -->
      <div
        v-if="isSelectedDatasetReady && vramStatus.ok"
        class="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-xs text-success"
      >
        <CheckCircle2 class="h-4 w-4 shrink-0 text-success" />
        <span class="text-[11px] leading-relaxed">
          Preflight verified: Dataset 100% tagged &amp; {{ selectedGpu?.name }} has sufficient VRAM
          headroom (~{{ estVramGb }} / {{ selectedGpu?.vramTotalGb }} GB).
        </span>
      </div>
    </div>

    <!-- Direction Guidance Footer -->
    <div
      v-if="overallReadiness.status === 'ready'"
      class="flex items-center justify-between text-[11px] text-muted pt-0.5"
    >
      <span>Launch training or queue the job from the header bar above.</span>
      <span class="font-mono text-primary font-medium">Ready ↑</span>
    </div>
    <div v-else class="flex items-center justify-between text-[11px] text-muted pt-0.5">
      <span>Resolve preflight warnings above before launching training.</span>
      <span class="font-mono text-warning font-medium">Locked ↑</span>
    </div>
  </section>
</template>
