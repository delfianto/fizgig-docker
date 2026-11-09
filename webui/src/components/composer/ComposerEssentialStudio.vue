<script setup lang="ts">
import { computed } from "vue";
import { type DatasetSummary } from "@shared/types";
import ComposerDatasetCard from "@/components/composer/essential/ComposerDatasetCard.vue";
import ComposerPromptsCard from "@/components/composer/essential/ComposerPromptsCard.vue";
import ComposerReadinessCard from "@/components/composer/essential/ComposerReadinessCard.vue";
import ComposerRecipeCard from "@/components/composer/essential/ComposerRecipeCard.vue";
import ComposerScheduleCard from "@/components/composer/essential/ComposerScheduleCard.vue";

const props = withDefaults(
  defineProps<{
    selectedDatasetInfo: DatasetSummary | null;
    parsedRecipe: { title: string; subtitle: string };
    currentPresetNote: string | null;
    canProcess?: boolean;
  }>(),
  {
    canProcess: true,
  },
);

const emit = defineEmits<{
  (e: "select-dataset", path: string): void;
  (e: "auto-name"): void;
  (e: "set-quick-epochs", epochs: number): void;
}>();

const isSelectedDatasetReady = computed(() => {
  const ds = props.selectedDatasetInfo;
  if (!ds) return false;
  const count = ds.count ?? ds.pictures ?? 0;
  if (count <= 0) return false;
  const captioned = ds.captioned ?? 0;
  return captioned >= count;
});
</script>

<template>
  <main class="flex-1 overflow-y-auto p-2.5 sm:p-3 lg:flex lg:flex-col">
    <div
      class="mx-auto w-full max-w-6xl grid grid-cols-1 gap-2.5 lg:grid-cols-12 lg:flex-1 lg:min-h-0"
    >
      <!-- LEFT COLUMN (7 cols): Data, Recipe Summary, and Schedule -->
      <div class="flex flex-col gap-2.5 lg:col-span-7 lg:min-h-0">
        <ComposerDatasetCard
          class="flex-1 min-h-90 max-h-170"
          :selected-dataset-info="selectedDatasetInfo"
          :is-selected-dataset-ready="isSelectedDatasetReady"
          @select-dataset="emit('select-dataset', $event)"
          @auto-name="emit('auto-name')"
        />

        <ComposerRecipeCard
          class="shrink-0"
          :parsed-recipe="parsedRecipe"
          :current-preset-note="currentPresetNote"
        />

        <ComposerScheduleCard
          class="shrink-0"
          @set-quick-epochs="emit('set-quick-epochs', $event)"
        />
      </div>

      <!-- RIGHT COLUMN (5 cols): Preview Prompts & Compute Device -->
      <div class="flex flex-col gap-2.5 lg:col-span-5 lg:min-h-0">
        <ComposerPromptsCard class="flex-1 min-h-90 max-h-170" />
        <ComposerReadinessCard class="shrink-0" />
      </div>
    </div>
  </main>
</template>
