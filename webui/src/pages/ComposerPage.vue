<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import PlanOverlayPopup from "@/components/common/PlanOverlayPopup.vue";
import ComposerEssentialStudio from "@/components/composer/ComposerEssentialStudio.vue";
import ComposerExpertTuning from "@/components/composer/ComposerExpertTuning.vue";
import ComposerHeaderBar from "@/components/composer/ComposerHeaderBar.vue";
import SubmitQueueModal from "@/components/composer/SubmitQueueModal.vue";
import { useComposerStore } from "@/stores/composer";
import { usePlanOverlayStore } from "@/stores/overlay";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";

const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();
const runStore = useRunStore();
const planOverlay = usePlanOverlayStore();

const composerMode = ref<"essential" | "expert">("essential");
const showQueueModal = ref(false);
const isSubmittingQueue = ref(false);

const selectedDatasetInfo = computed(() => {
  return schemaStore.datasets.find((d) => d.path === composerStore.imageFolder) ?? null;
});

const isDatasetCompletelyTagged = computed(() => {
  const ds = selectedDatasetInfo.value;
  if (!ds) return false;
  const count = ds.count ?? ds.pictures ?? 0;
  if (count <= 0) return false;
  const captioned = ds.captioned ?? 0;
  return captioned >= count;
});

const currentPresetNote = computed(() => {
  const fam = composerStore.currentFamilyDesc;
  if (!fam?.preset_notes) return null;
  return fam.preset_notes[composerStore.presetName] ?? null;
});

const selectedGpuName = computed(() => {
  const statGpus = runStore.stats?.gpus;
  if (Array.isArray(statGpus)) {
    const found = statGpus.find((g) => g.index === composerStore.selectedGpuIndex);
    if (found) {
      return `${found.name.replace(/^NVIDIA GeForce\s+/, "")} (GPU ${found.index})`;
    }
  }
  return `GPU ${composerStore.selectedGpuIndex}`;
});

const parsedRecipe = computed(() => {
  const raw = composerStore.presetName || "Custom Recipe";
  const match = raw.match(/^(.*?)(?:\s*\((.*?)\)\s*)?$/);
  if (match && match[2]) {
    return {
      title: match[1]?.trim() || raw,
      subtitle: match[2]?.trim() || "",
    };
  }
  return {
    title: raw,
    subtitle: "",
  };
});

function autoSuggestLoraName(asBaseline = true): void {
  const ds = selectedDatasetInfo.value?.name;
  if (!ds) return;
  const clean = ds.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const fam = composerStore.family;
  const name = `${clean}_${fam}_v1`;
  composerStore.setFieldValue("LORA_NAME", name);
  if (asBaseline || !composerStore.modifiedKeys.has("LORA_NAME")) {
    composerStore.baselineValues.LORA_NAME = name;
  }
}

function selectDataset(path: string): void {
  composerStore.setImageFolder(path);
  const currentName = String(composerStore.draftValues.LORA_NAME ?? "");
  if (
    !currentName ||
    currentName.startsWith("my_lora_") ||
    currentName.endsWith(`_${composerStore.family}_v1`)
  ) {
    autoSuggestLoraName(true);
  }
}

function setQuickEpochs(epochs: number): void {
  composerStore.setFieldValue("MAX_TRAIN_EPOCHS", epochs);
}

async function handleValidatePlan(): Promise<void> {
  try {
    const res = await composerStore.validatePlan();
    const hasProblems = Boolean(res.problems && res.problems.length > 0);
    const hasWarnings = Boolean(res.warnings && res.warnings.length > 0);

    if (!hasProblems && !hasWarnings) {
      planOverlay.show({
        status: "success",
        title: "Plan Validated Cleanly",
        message:
          "All hyperparameters, dataset paths, and compute device tolerances are in the green.",
        duration: 4000,
      });
    } else {
      planOverlay.show({
        status: hasProblems ? "attention" : "warning",
        title: hasProblems ? "Plan Blockers Detected" : "Plan Advisory Warnings",
        problems: res.problems ?? [],
        warnings: res.warnings ?? [],
        duration: 7500,
      });
    }
  } catch (err) {
    planOverlay.show({
      status: "attention",
      title: "Plan Validation Error",
      message: err instanceof Error ? err.message : "Plan validation failed",
      duration: 7500,
    });
  }
}

function handleQueueRun(): void {
  if (!isDatasetCompletelyTagged.value) {
    planOverlay.show({
      status: "attention",
      title: "Dataset Incompletely Tagged",
      message: `Dataset "${selectedDatasetInfo.value?.name ?? "selected"}" has uncaptioned images (${selectedDatasetInfo.value?.captioned ?? 0}/${selectedDatasetInfo.value?.count ?? 0}). All images must have captions before adding this job to the training queue.`,
      duration: 8000,
    });
    return;
  }
  showQueueModal.value = true;
}

async function confirmQueueSubmission(): Promise<void> {
  isSubmittingQueue.value = true;
  try {
    const res = await composerStore.submitQueueTraining();
    const hasProblems = Boolean(res.problems && res.problems.length > 0);
    const hasWarnings = Boolean(res.warnings && res.warnings.length > 0);

    if (hasProblems || hasWarnings) {
      showQueueModal.value = false;
      planOverlay.show({
        status: hasProblems ? "attention" : "warning",
        title: hasProblems ? "Cannot Queue: Blockers Detected" : "Cannot Queue: Advisory Warnings",
        problems: res.problems ?? [],
        warnings: res.warnings ?? [],
        duration: 8000,
      });
      return;
    }
    showQueueModal.value = false;
    toast.success(`Job "${composerStore.draftValues.LORA_NAME}" submitted to background queue`);
    await runStore.pollRun();
  } catch (err) {
    showQueueModal.value = false;
    planOverlay.show({
      status: "attention",
      title: "Cannot Add to Queue",
      message: err instanceof Error ? err.message : "Queue submission failed",
      duration: 8000,
    });
  } finally {
    isSubmittingQueue.value = false;
  }
}

async function handleStartRun(): Promise<void> {
  if (!isDatasetCompletelyTagged.value) {
    planOverlay.show({
      status: "attention",
      title: "Dataset Incompletely Tagged",
      message: `Dataset "${selectedDatasetInfo.value?.name ?? "selected"}" has uncaptioned images (${selectedDatasetInfo.value?.captioned ?? 0}/${selectedDatasetInfo.value?.count ?? 0}). All images must have captions before starting training.`,
      duration: 8000,
    });
    return;
  }

  try {
    const res = await composerStore.submitStartTraining();
    const hasProblems = Boolean(res.problems && res.problems.length > 0);
    const hasWarnings = Boolean(res.warnings && res.warnings.length > 0);

    if (hasProblems || hasWarnings) {
      planOverlay.show({
        status: hasProblems ? "attention" : "warning",
        title: hasProblems ? "Cannot Start: Blockers Detected" : "Cannot Start: Advisory Warnings",
        problems: res.problems ?? [],
        warnings: res.warnings ?? [],
        duration: 8000,
      });
      return;
    }
    toast.success(`Started training "${composerStore.draftValues.LORA_NAME}"`);
    await runStore.pollRun();
    void router.push("/cockpit");
  } catch (err) {
    planOverlay.show({
      status: "attention",
      title: "Cannot Start Training",
      message: err instanceof Error ? err.message : "Start training failed",
      duration: 8000,
    });
  }
}

onMounted(async () => {
  await Promise.all([schemaStore.fetchSchema(), schemaStore.fetchDatasets()]);
  if (Object.keys(composerStore.draftValues).length === 0) {
    await composerStore.selectFamily(composerStore.family || "krea2");
  }
  if (!composerStore.imageFolder && schemaStore.datasets.length > 0) {
    selectDataset(schemaStore.datasets[0]!.path);
  }
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-canvas">
    <!-- Top Composer Control Bar -->
    <ComposerHeaderBar
      v-model:mode="composerMode"
      :can-process="isDatasetCompletelyTagged"
      :selected-dataset-info="selectedDatasetInfo"
      @validate-plan="handleValidatePlan"
      @queue-run="handleQueueRun"
      @start-run="handleStartRun"
    />

    <!-- VIEW A: ESSENTIAL STUDIO -->
    <ComposerEssentialStudio
      v-if="composerMode === 'essential'"
      :selected-dataset-info="selectedDatasetInfo"
      :parsed-recipe="parsedRecipe"
      :current-preset-note="currentPresetNote"
      :can-process="isDatasetCompletelyTagged"
      @select-dataset="selectDataset"
      @auto-name="autoSuggestLoraName"
      @set-quick-epochs="setQuickEpochs"
    />

    <!-- VIEW B: EXPERT TUNING -->
    <ComposerExpertTuning v-else />

    <!-- Global Plan Validation & Alert Modal -->
    <PlanOverlayPopup />

    <!-- Confirmation Dialog for Submitting Job to Queue -->
    <SubmitQueueModal
      :open="showQueueModal"
      :lora-name="String(composerStore.draftValues.LORA_NAME || '')"
      :family="composerStore.family"
      :family-label="
        composerStore.currentFamilyDesc?.gui_label || composerStore.currentFamilyDesc?.display_name
      "
      :gpu-name="selectedGpuName"
      :recipe-title="parsedRecipe.title"
      :dataset-name="selectedDatasetInfo?.name || composerStore.imageFolder || 'Unknown'"
      :dataset-count="selectedDatasetInfo?.count ?? 0"
      :epochs="Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30)"
      :is-submitting="isSubmittingQueue"
      @confirm="confirmQueueSubmission"
      @close="showQueueModal = false"
    />
  </div>
</template>
