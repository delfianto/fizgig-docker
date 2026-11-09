<script setup lang="ts">
import { ref, watch } from "vue";
import { CheckCircle2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { apiPost } from "@/api/client";
import { BaseButton, BaseInput } from "@/components/common";

const props = defineProps<{
  selectedFolder: string;
}>();

const prepInputFolder = ref(props.selectedFolder);
const prepOutputFolder = ref("");
const prepSummary = ref<Record<string, unknown> | null>(null);
const loadingPrep = ref(false);

watch(
  () => props.selectedFolder,
  (folder) => {
    if (folder) prepInputFolder.value = folder;
  },
);

async function inspectPrepFolder(): Promise<void> {
  const folder = prepInputFolder.value || props.selectedFolder;
  if (!folder) return;
  loadingPrep.value = true;
  try {
    prepSummary.value = await apiPost<Record<string, unknown>>("/api/prep/summary", {
      input_folder: folder,
      folder,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Prep summary failed");
  } finally {
    loadingPrep.value = false;
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-3xl space-y-4">
      <div class="rounded-lg border border-base-300 bg-base-200 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-base-content">
          Dataset Aspect-Ratio &amp; Prep Inspector
        </h3>
        <p class="text-xs text-base-content/60">
          Inspect aspect-ratio bucketing, resolution distribution, and prepare cropped/resized
          copies without modifying raw source files.
        </p>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="label py-1 text-xs font-medium text-base-content/75">
              Source Image Folder
            </label>
            <BaseInput v-model="prepInputFolder" mono />
          </div>
          <div>
            <label class="label py-1 text-xs font-medium text-base-content/75">
              Prepared Output Folder (Optional)
            </label>
            <BaseInput v-model="prepOutputFolder" mono placeholder="/datasets/my_dataset_prepped" />
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <BaseButton variant="primary" :disabled="loadingPrep" @click="inspectPrepFolder">
            <template #icon-left><CheckCircle2 class="h-4 w-4" /></template>
            <span>Inspect Folder Summary</span>
          </BaseButton>
        </div>
      </div>

      <div v-if="prepSummary" class="rounded-lg border border-base-300 bg-base-200 p-4">
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/60">
          Folder Inspection Report
        </h4>
        <pre
          class="overflow-x-auto rounded bg-base-300/70 p-3 font-mono text-xs text-base-content/85"
          >{{ JSON.stringify(prepSummary, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
