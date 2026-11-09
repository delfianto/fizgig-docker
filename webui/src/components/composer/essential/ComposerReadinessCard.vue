<script setup lang="ts">
import { computed, onMounted } from "vue";
import { AlertTriangle, Cpu } from "lucide-vue-next";
import { BaseSelect } from "@/components/common";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSystemStore } from "@/stores/system";

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
        vramTotalGb: Math.round(total / (1024 * 1024 * 1024)),
        vramFreeGb: Math.round((free / (1024 * 1024 * 1024)) * 10) / 10,
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
        vramTotalGb: Math.round(g.total_gb || 16),
        vramFreeGb: Math.round(((g.total_gb || 16) - (g.used_gb || 0)) * 10) / 10,
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
      vramTotalGb: Math.round(total / (1024 * 1024 * 1024)),
      vramFreeGb: Math.round((free / (1024 * 1024 * 1024)) * 10) / 10,
    },
  ];
});

const gpuSelectOptions = computed(() => {
  return availableGpus.value.map((g) => ({
    value: g.index,
    label: `GPU ${g.index}: ${g.name} (${g.vramTotalGb} GB)`,
  }));
});

const selectedGpu = computed(() => {
  const target = availableGpus.value.find((g) => g.index === composerStore.selectedGpuIndex);
  return target || availableGpus.value[0] || null;
});

function onSelectGpu(value: string | number): void {
  const idx = Number(value);
  if (!Number.isNaN(idx)) {
    void composerStore.setSelectedGpu(idx);
  }
}

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

const computeStatus = computed(() => {
  if (vramStatus.value.ok) {
    return {
      status: "ready",
      label: "Ready",
      badgeClass: "badge-success",
      cardBorder: "border-hairline bg-base-200/50",
    };
  }

  return {
    status: "warning-vram",
    label: vramStatus.value.isSevereOom ? "OOM Inevitable" : "High OOM Risk",
    badgeClass: vramStatus.value.isSevereOom ? "badge-error" : "badge-warning",
    cardBorder: vramStatus.value.isSevereOom
      ? "border-error/30 bg-error/5"
      : "border-warning/30 bg-warning/5",
  };
});
</script>

<template>
  <section
    class="rounded-xl border p-2.5 space-y-2 transition-colors"
    :class="computeStatus.cardBorder"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-hairline/60 pb-1.5">
      <div class="flex items-center gap-2">
        <Cpu class="h-4 w-4 text-primary" />
        <h3 class="text-xs font-bold uppercase tracking-wider text-base-content">Compute Device</h3>
      </div>
      <span class="badge badge-sm font-semibold text-[11px]" :class="computeStatus.badgeClass">
        {{ computeStatus.label }}
      </span>
    </div>

    <!-- GPU Select Box -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <label class="text-xs font-semibold text-subtle">
          <span>Target Training GPU:</span>
        </label>
        <span class="text-[11px] font-mono text-muted">
          {{ availableGpus.length }} device(s) detected
        </span>
      </div>

      <BaseSelect
        :model-value="composerStore.selectedGpuIndex"
        :options="gpuSelectOptions"
        size="default"
        class="w-full font-mono text-xs font-semibold"
        @update:model-value="onSelectGpu"
      />
    </div>

    <!-- Estimated VRAM Telemetry & Headroom Strip -->
    <div
      class="flex items-center justify-between rounded-lg border border-hairline bg-base-300/70 px-2.5 py-1.5 text-xs font-mono"
    >
      <div class="flex items-center gap-1.5 text-subtle truncate">
        <span class="text-[11px] text-muted">Est. VRAM:</span>
        <span class="font-bold text-base-content text-[11px]">~{{ estVramGb }} GB</span>
        <span class="text-muted">·</span>
        <span class="text-[11px] text-muted truncate">
          Free: {{ selectedGpu?.vramFreeGb ?? 0 }} / {{ selectedGpu?.vramTotalGb ?? 0 }} GB
        </span>
      </div>
      <div class="flex items-center gap-1 text-[11px] shrink-0">
        <span class="text-muted">Headroom:</span>
        <span
          class="font-bold font-mono"
          :class="vramStatus.ok ? 'text-success' : 'text-error animate-pulse'"
        >
          {{ vramStatus.headroomGb >= 0 ? `+${vramStatus.headroomGb}` : vramStatus.headroomGb }} GB
        </span>
      </div>
    </div>

    <!-- Insufficient VRAM / OOM Risk Warning Callout (only when VRAM has risk) -->
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
  </section>
</template>
