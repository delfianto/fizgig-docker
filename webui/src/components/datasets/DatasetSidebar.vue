<script setup lang="ts">
import { ArrowRight, FolderOpen, RefreshCw } from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";

defineProps<{
  datasets: DatasetSummary[];
  selectedFolder: string;
}>();

const emit = defineEmits<{
  (e: "select", folder: string): void;
  (e: "send-to-composer", folder: string): void;
  (e: "refresh"): void;
}>();
</script>

<template>
  <aside class="flex flex-col border-r border-base-300 bg-base-200/50 overflow-hidden">
    <div class="flex items-center justify-between border-b border-base-300 px-3.5 py-2.5">
      <div class="flex items-center gap-2">
        <FolderOpen class="h-4 w-4 text-primary" />
        <h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
          Datasets ({{ datasets.length }})
        </h2>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-xs text-base-content/60 cursor-pointer"
        title="Refresh datasets"
        @click="emit('refresh')"
      >
        <RefreshCw class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="ds in datasets"
        :key="ds.path"
        class="group rounded border p-2.5 transition-colors cursor-pointer"
        :class="
          selectedFolder === ds.path
            ? 'border-primary/50 bg-primary/10'
            : 'border-base-300/60 bg-base-200/60 hover:border-base-300 hover:bg-base-200'
        "
        @click="emit('select', ds.path)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-xs font-semibold text-base-content">
            {{ ds.name }}
          </span>
          <span class="badge badge-xs border-base-300 bg-base-300/70 font-mono text-[10px]">
            {{ ds.count }} img
          </span>
        </div>
        <div class="mt-1 truncate font-mono text-[11px] text-base-content/45">
          {{ ds.path }}
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span
            v-if="ds.captioned !== undefined"
            class="text-[10px] font-mono"
            :class="ds.captioned >= ds.count ? 'text-success' : 'text-warning'"
          >
            {{ ds.captioned }}/{{ ds.count }} captioned
          </span>
          <button
            type="button"
            class="btn btn-xs btn-ghost h-5 min-h-0 px-1.5 text-[10px] text-primary opacity-80 hover:opacity-100 cursor-pointer"
            @click.stop="emit('send-to-composer', ds.path)"
          >
            <span>Use in Run</span>
            <ArrowRight class="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
