<script setup lang="ts">
import { ArrowRight, FolderOpen, RefreshCw } from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";
import { BaseBadge, BaseButton } from "@/components/common";

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
  <aside class="flex flex-col border-r border-hairline bg-base-200/70 overflow-hidden">
    <div class="flex items-center justify-between border-b border-hairline px-3.5 py-2.5">
      <div class="flex items-center gap-2">
        <FolderOpen class="h-4 w-4 text-primary" />
        <h2 class="text-xs font-semibold uppercase tracking-wider text-subtle">
          Datasets ({{ datasets.length }})
        </h2>
      </div>
      <BaseButton size="icon-xs" variant="ghost" title="Refresh datasets" @click="emit('refresh')">
        <RefreshCw class="h-3.5 w-3.5" />
      </BaseButton>
    </div>

    <div class="flex-1 overflow-y-auto p-2 flex flex-col">
      <!-- Centered Empty State -->
      <div
        v-if="datasets.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center select-none"
      >
        <div
          class="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-base-300/80 text-muted"
        >
          <FolderOpen class="h-5.5 w-5.5 text-muted" />
        </div>
        <div class="space-y-1">
          <h3 class="text-xs font-bold uppercase tracking-wider text-subtle">No Dataset Found</h3>
          <p class="text-[11px] text-muted max-w-44 leading-relaxed">
            No dataset folders available in root
          </p>
        </div>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="ds in datasets"
          :key="ds.path"
          class="group rounded-lg border p-2.5 transition-colors cursor-pointer"
          :class="
            selectedFolder === ds.path
              ? 'border-primary/50 bg-primary/12'
              : 'border-hairline bg-base-300/60 hover:border-hairline-strong hover:bg-surface-hover'
          "
          @click="emit('select', ds.path)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-xs font-semibold text-base-content">
              {{ ds.name }}
            </span>
            <BaseBadge variant="neutral" mono>{{ ds.count }} img</BaseBadge>
          </div>
          <div class="mt-1 truncate font-mono text-[11px] text-muted">
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
            <BaseButton
              size="xs"
              variant="bare"
              class="text-primary hover:bg-primary/10 px-1.5"
              @click.stop="emit('send-to-composer', ds.path)"
            >
              <span>Use in Run</span>
              <template #icon-right><ArrowRight class="h-3 w-3" /></template>
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
