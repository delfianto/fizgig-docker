<script setup lang="ts">
import { computed } from "vue";
import { Activity, Cpu, HardDrive, Layers } from "lucide-vue-next";
import { type GpuStatsResponse } from "@shared/types";
import { formatBytes } from "@/api/client";
import { BaseBadge, BaseCard } from "@/components/common";
import { gpuVramPercent, resolveAvailableGpus } from "@/utils";

const props = defineProps<{
  stats: GpuStatsResponse;
}>();

const gpus = computed(() => resolveAvailableGpus(props.stats));
</script>

<template>
  <BaseCard
    title="Compute Devices &amp; Host Storage Telemetry"
    subtitle="Real-time multi-GPU VRAM allocation, thermal headroom, host memory, and container workspace capacity."
  >
    <template #icon>
      <HardDrive class="h-4 w-4 text-info" />
    </template>
    <template #actions>
      <BaseBadge variant="neutral" size="sm" mono>{{ gpus.length }} GPU(s)</BaseBadge>
    </template>

    <div class="space-y-3">
      <!-- Multi-GPU Grid -->
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="gpu in gpus"
          :key="gpu.index"
          class="rounded-lg border border-hairline bg-base-300/60 p-3.5 space-y-2.5"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <Cpu
                class="h-4 w-4 shrink-0"
                :class="gpu.index === 0 ? 'text-primary' : 'text-info'"
              />
              <span class="font-mono text-xs font-bold text-base-content truncate">
                GPU {{ gpu.index }}: {{ gpu.name }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <BaseBadge :variant="gpu.util > 80 ? 'primary' : 'neutral'" mono>
                {{ gpu.util }}% load
              </BaseBadge>
              <BaseBadge
                v-if="gpu.temp"
                :variant="gpu.temp >= 80 ? 'error' : gpu.temp >= 68 ? 'warning' : 'neutral'"
                mono
              >
                {{ gpu.temp }}°C
              </BaseBadge>
              <BaseBadge v-if="gpu.power" variant="outline" mono>
                {{ gpu.power }}W{{ gpu.powerLimit ? ` / ${gpu.powerLimit}W` : "" }}
              </BaseBadge>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between font-mono text-[11px] text-subtle">
              <span>
                VRAM: {{ formatBytes(gpu.vramUsedBytes) }} / {{ formatBytes(gpu.vramTotalBytes) }}
              </span>
              <span class="text-muted">{{ gpu.vramFreeGb }} GB free</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-base-100">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="
                  gpuVramPercent(gpu.vramUsedBytes, gpu.vramTotalBytes) > 92
                    ? 'bg-warning'
                    : 'bg-primary'
                "
                :style="{ width: `${gpuVramPercent(gpu.vramUsedBytes, gpu.vramTotalBytes)}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- CPU, System Memory & Workspace Storage -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-hairline bg-base-300/60 p-3">
          <div
            class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"
          >
            <Activity class="h-3.5 w-3.5 text-info" />
            <span>Host CPU</span>
          </div>
          <div class="mt-1 font-mono text-xs font-semibold text-base-content">
            {{ stats.cpu_util ?? 0 }}% Utilization
          </div>
          <div class="mt-1 font-mono text-[11px] text-muted">
            Temp: {{ stats.cpu_temp ? `${stats.cpu_temp}°C` : "—" }} · Peak VRAM:
            {{ formatBytes(stats.vram_peak) }}
          </div>
        </div>

        <div class="rounded-lg border border-hairline bg-base-300/60 p-3">
          <div
            class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"
          >
            <Layers class="h-3.5 w-3.5 text-info" />
            <span>System Memory</span>
          </div>
          <div class="mt-1 font-mono text-xs font-semibold text-base-content">
            {{ formatBytes(stats.ram[0]) }} / {{ formatBytes(stats.ram[1]) }}
          </div>
          <div class="mt-1 font-mono text-[11px] text-muted">
            RAM Peak: {{ formatBytes(stats.ram_peak) }}
          </div>
        </div>

        <div class="rounded-lg border border-hairline bg-base-300/60 p-3">
          <div
            class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted truncate"
          >
            <HardDrive class="h-3.5 w-3.5 text-muted shrink-0" />
            <span class="truncate">Storage ({{ stats.disk.path }})</span>
          </div>
          <div class="mt-1 font-mono text-xs font-semibold text-base-content">
            {{ formatBytes(stats.disk.free) }} Free
          </div>
          <div class="mt-1 font-mono text-[11px] text-muted">
            Total: {{ formatBytes(stats.disk.total) }}
          </div>
        </div>
      </div>
    </div>
  </BaseCard>
</template>
