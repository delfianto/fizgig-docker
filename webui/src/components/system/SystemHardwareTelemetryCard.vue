<script setup lang="ts">
import { HardDrive } from "lucide-vue-next";
import { type GpuStatsResponse } from "@shared/types";
import { formatBytes } from "@/api/client";

defineProps<{
  stats: GpuStatsResponse;
}>();
</script>

<template>
  <section class="rounded-lg border border-base-300 bg-base-200/80 p-5 space-y-3">
    <div class="flex items-center gap-2.5">
      <HardDrive class="h-4 w-4 text-info" />
      <h2 class="text-sm font-semibold text-base-content">
        Compute Device &amp; Storage Telemetry
      </h2>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded border border-base-300 bg-base-300/40 p-3">
        <div class="text-[11px] uppercase tracking-wider text-base-content/50">Accelerator</div>
        <div class="mt-1 font-mono text-xs font-semibold text-base-content">
          {{ stats.device_name }}
        </div>
        <div class="mt-1 font-mono text-[11px] text-base-content/65">
          VRAM Peak: {{ formatBytes(stats.vram_peak) }}
        </div>
      </div>

      <div class="rounded border border-base-300 bg-base-300/40 p-3">
        <div class="text-[11px] uppercase tracking-wider text-base-content/50">System Memory</div>
        <div class="mt-1 font-mono text-xs font-semibold text-base-content">
          {{ formatBytes(stats.ram[0]) }} / {{ formatBytes(stats.ram[1]) }}
        </div>
        <div class="mt-1 font-mono text-[11px] text-base-content/65">
          RAM Peak: {{ formatBytes(stats.ram_peak) }}
        </div>
      </div>

      <div class="rounded border border-base-300 bg-base-300/40 p-3">
        <div class="text-[11px] uppercase tracking-wider text-base-content/50">
          Workspace Storage ({{ stats.disk.path }})
        </div>
        <div class="mt-1 font-mono text-xs font-semibold text-base-content">
          {{ formatBytes(stats.disk.free) }} Free
        </div>
        <div class="mt-1 font-mono text-[11px] text-base-content/65">
          Total: {{ formatBytes(stats.disk.total) }}
        </div>
      </div>
    </div>
  </section>
</template>
