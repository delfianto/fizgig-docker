<script setup lang="ts">
import { computed } from "vue";
import { Activity, Cpu, HardDrive, Layers } from "lucide-vue-next";
import { formatBytes } from "@/api/client";
import { useRunStore } from "@/stores/run";

const runStore = useRunStore();

function cleanGpuName(raw: string): string {
  return raw
    .replace(/^NVIDIA\s+/i, "")
    .replace(/^GeForce\s+/i, "")
    .trim();
}

const gpus = computed(() => {
  if (runStore.stats?.gpus && runStore.stats.gpus.length > 0) {
    return runStore.stats.gpus;
  }
  if (runStore.stats?.vram) {
    return [
      {
        index: 0,
        name: cleanGpuName(runStore.stats.device_name) || "GPU 0",
        vram: runStore.stats.vram,
        util: runStore.stats.gpu_util ?? 0,
        temp: runStore.stats.gpu_temp ?? 0,
        power: undefined,
        power_limit: undefined,
      },
    ];
  }
  return [];
});

const ramPercent = computed(() => {
  const r = runStore.stats?.ram;
  if (!r || !r[1]) return 0;
  return Math.min(100, Math.round((r[0] / r[1]) * 100));
});

function gpuVramPercent(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
</script>

<template>
  <header
    class="flex h-11 shrink-0 items-center border-b border-hairline bg-base-200 px-3.5 text-xs select-none"
  >
    <!-- Telemetry Cluster: Multi-GPU, CPU, RAM, Disk (No redundant brand text) -->
    <div
      class="font-mono-num flex shrink-0 items-center gap-1.5 text-xs text-subtle overflow-x-auto scrollbar-none"
    >
      <!-- GPUs Telemetry: Primary on all screens, Secondary on lg+ (1024px+) -->
      <div
        v-for="gpu in gpus"
        :key="gpu.index"
        class="shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-base-300/80 px-2 py-1"
        :class="gpu.index === 0 ? 'flex' : 'hidden lg:flex'"
        :title="`${gpu.name} (${gpu.power ? `${gpu.power}W / ${gpu.power_limit}W` : 'Active'})`"
      >
        <Cpu
          class="h-3.5 w-3.5 shrink-0"
          :class="gpu.index === 0 ? 'text-primary' : 'text-accent'"
        />

        <!-- GPU Name -->
        <span class="shrink-0 font-sans font-bold text-base-content text-[11px] whitespace-nowrap">
          {{ cleanGpuName(gpu.name) }}
        </span>

        <!-- VRAM Used / Total & Meter -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="shrink-0 text-right font-mono text-[11px] text-muted whitespace-nowrap">
            {{ formatBytes(gpu.vram[0]).replace(" GB", "") }} /
            {{ formatBytes(gpu.vram[1]).replace(".0 GB", " GB") }}
          </span>
          <div
            class="h-2 w-10 min-[1380px]:w-14 shrink-0 overflow-hidden rounded-full border border-white/20 bg-base-100"
            :title="`VRAM: ${formatBytes(gpu.vram[0])} / ${formatBytes(gpu.vram[1])} (${gpuVramPercent(gpu.vram[0], gpu.vram[1])}%)`"
          >
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="
                gpuVramPercent(gpu.vram[0], gpu.vram[1]) > 92
                  ? 'bg-warning'
                  : gpu.index === 0
                    ? 'bg-primary'
                    : 'bg-accent'
              "
              :style="{ width: `${gpuVramPercent(gpu.vram[0], gpu.vram[1])}%` }"
            />
          </div>
        </div>

        <!-- GPU Load Badge -->
        <span
          class="badge badge-xs w-9 shrink-0 justify-center font-mono font-semibold text-[10px] px-0"
          :class="gpu.util > 80 ? 'badge-primary' : 'bg-base-200 text-subtle'"
        >
          {{ gpu.util }}%
        </span>

        <!-- GPU Temp -->
        <span
          v-if="gpu.temp"
          class="w-8.5 shrink-0 text-right font-mono text-[11px]"
          :class="
            gpu.temp >= 80
              ? 'text-error font-bold'
              : gpu.temp >= 68
                ? 'text-warning font-semibold'
                : 'text-subtle'
          "
        >
          {{ gpu.temp }}°C
        </span>

        <!-- GPU Power (Live Watts) -->
        <span
          v-if="gpu.power"
          class="shrink-0 text-right font-mono text-[10px] text-muted whitespace-nowrap"
          :title="`Power: ${gpu.power}W / ${gpu.power_limit}W`"
        >
          {{ gpu.power }}W
        </span>
      </div>

      <!-- CPU Telemetry -->
      <div
        v-if="runStore.stats?.cpu_util !== undefined"
        class="hidden sm:flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-base-300/80 px-2 py-1"
        title="Host CPU Telemetry"
      >
        <Activity class="h-3.5 w-3.5 text-info shrink-0" />
        <span class="font-sans font-bold text-base-content text-[11px]">CPU</span>

        <!-- CPU Load -->
        <span class="w-8 shrink-0 text-right font-mono text-[11px] text-base-content font-semibold">
          {{ runStore.stats.cpu_util }}%
        </span>

        <!-- CPU Temp -->
        <span
          v-if="runStore.stats?.cpu_temp"
          class="w-8.5 shrink-0 text-right font-mono text-[11px]"
          :class="
            runStore.stats.cpu_temp >= 80
              ? 'text-error font-bold'
              : runStore.stats.cpu_temp >= 70
                ? 'text-warning font-semibold'
                : 'text-subtle'
          "
        >
          {{ runStore.stats.cpu_temp }}°C
        </span>
      </div>

      <!-- System RAM Telemetry: Enclosed Pill Format Matching Others -->
      <div
        v-if="runStore.stats"
        class="hidden md:flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-base-300/80 px-2 py-1"
        :title="`Host System RAM: ${formatBytes(runStore.stats.ram[0])} / ${formatBytes(runStore.stats.ram[1])} (${ramPercent}%)`"
      >
        <Layers class="h-3.5 w-3.5 text-info shrink-0" />
        <span class="font-sans font-bold text-base-content text-[11px]">RAM</span>

        <!-- RAM Used / Total -->
        <span class="shrink-0 font-mono text-[11px] text-muted whitespace-nowrap">
          {{ formatBytes(runStore.stats.ram[0]).replace(" GB", "") }} /
          {{ formatBytes(runStore.stats.ram[1]).replace(".0 GB", " GB") }}
        </span>
      </div>

      <!-- Output Disk Free: Pill Format -->
      <div
        v-if="runStore.stats?.disk"
        class="hidden xl:flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-base-300/80 px-2 py-1"
        :title="`Output path: ${runStore.stats.disk.path}`"
      >
        <HardDrive class="h-3.5 w-3.5 text-muted shrink-0" />
        <span class="text-right font-mono text-[11px] whitespace-nowrap">
          {{ Math.round(runStore.stats.disk.free / 1073741824) }} GB free
        </span>
      </div>
    </div>
  </header>
</template>
