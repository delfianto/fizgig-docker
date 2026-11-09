<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import PlanOverlayPopup from "@/components/common/PlanOverlayPopup.vue";
import ComposerEssentialStudio from "@/components/composer/ComposerEssentialStudio.vue";
import ComposerExpertTuning from "@/components/composer/ComposerExpertTuning.vue";
import ComposerHeaderBar from "@/components/composer/ComposerHeaderBar.vue";
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

const selectedDatasetInfo = computed(() => {
  return schemaStore.datasets.find((d) => d.path === composerStore.imageFolder) ?? null;
});

const currentPresetNote = computed(() => {
  const fam = composerStore.currentFamilyDesc;
  if (!fam?.preset_notes) return null;
  return fam.preset_notes[composerStore.presetName] ?? null;
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

function autoSuggestLoraName(): void {
  const ds = selectedDatasetInfo.value?.name;
  if (!ds) return;
  const clean = ds.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const fam = composerStore.family;
  composerStore.setFieldValue("LORA_NAME", `${clean}_${fam}_v1`);
}

function selectDataset(path: string): void {
  composerStore.setImageFolder(path);
  if (!composerStore.draftValues.LORA_NAME) {
    autoSuggestLoraName();
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

async function handleQueueRun(): Promise<void> {
  try {
    const res = await composerStore.submitQueueTraining();
    const hasProblems = Boolean(res.problems && res.problems.length > 0);
    const hasWarnings = Boolean(res.warnings && res.warnings.length > 0);

    if (hasProblems || hasWarnings) {
      planOverlay.show({
        status: hasProblems ? "attention" : "warning",
        title: hasProblems ? "Cannot Queue: Blockers Detected" : "Cannot Queue: Advisory Warnings",
        problems: res.problems ?? [],
        warnings: res.warnings ?? [],
        duration: 8000,
      });
      return;
    }
    toast.success(`Added "${composerStore.draftValues.LORA_NAME}" to queue`);
    await runStore.pollRun();
  } catch (err) {
    planOverlay.show({
      status: "attention",
      title: "Cannot Add to Queue",
      message: err instanceof Error ? err.message : "Queue submission failed",
      duration: 8000,
    });
  }
}

async function handleStartRun(): Promise<void> {
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
      @start-run="handleStartRun"
      @queue-run="handleQueueRun"
      @switch-to-expert="composerMode = 'expert'"
      @select-dataset="selectDataset"
      @auto-name="autoSuggestLoraName"
      @set-quick-epochs="setQuickEpochs"
    />

    <!-- VIEW B: EXPERT TUNING -->
    <ComposerExpertTuning v-else />

    <!-- Global Plan Validation & Alert Modal -->
    <PlanOverlayPopup />
  </div>
</template>
