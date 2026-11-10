<script setup lang="ts">
import { computed } from "vue";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ListPlus,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";
import BaseButton from "@/components/common/BaseButton.vue";
import BasePillGroup from "@/components/common/BasePillGroup.vue";
import BaseSelect from "@/components/common/BaseSelect.vue";
import { evaluateVramHeadroom, resolveAvailableGpus } from "@/utils";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";
import { useSystemStore } from "@/stores/system";

const props = withDefaults(
  defineProps<{
    mode: "essential" | "expert";
    canProcess?: boolean;
    selectedDatasetInfo?: DatasetSummary | null;
  }>(),
  {
    canProcess: true,
    selectedDatasetInfo: null,
  },
);

const emit = defineEmits<{
  (e: "update:mode", mode: "essential" | "expert"): void;
  (e: "validate-plan"): void;
  (e: "queue-run"): void;
  (e: "start-run"): void;
}>();

const schemaStore = useSchemaStore();
const composerStore = useComposerStore();
const runStore = useRunStore();
const systemStore = useSystemStore();

const selectedGpu = computed(() => {
  const gpus = resolveAvailableGpus(runStore.stats, systemStore.prefs);
  return gpus.find((g) => g.index === composerStore.selectedGpuIndex) ?? gpus[0] ?? null;
});

const vramStatus = computed(() => {
  return evaluateVramHeadroom(selectedGpu.value, composerStore.estimatedVramGb);
});

const headerStatusMessage = computed(() => {
  // 1. Dataset incomplete check
  if (!props.canProcess) {
    if (props.selectedDatasetInfo && (props.selectedDatasetInfo.count ?? 0) > 0) {
      return {
        kind: "warning",
        title: "Training Locked",
        text: `Dataset incomplete (${props.selectedDatasetInfo.captioned ?? 0}/${props.selectedDatasetInfo.count} tagged). 100% required.`,
      };
    }
    return {
      kind: "warning",
      title: "Training Locked",
      text: "No valid dataset selected. 100% tagged dataset required.",
    };
  }

  // 2. VRAM OOM check
  if (!vramStatus.value.ok && selectedGpu.value) {
    return {
      kind: "warning",
      title: "High OOM Risk",
      text: `Est. ~${composerStore.estimatedVramGb} GB exceeds free ${selectedGpu.value.vramFreeGb} GB on ${selectedGpu.value.name}.`,
    };
  }

  // 3. Active run on GPU
  if (runStore.isActiveOrStarting) {
    return {
      kind: "info",
      title: "GPU Busy",
      text: "Training in progress. Use Add to Queue.",
    };
  }

  // 4. Ready to train
  return {
    kind: "ready",
    title: "Ready to Train",
    text: selectedGpu.value
      ? `GPU ${selectedGpu.value.index} (${selectedGpu.value.name}) · Est. ~${composerStore.estimatedVramGb} GB`
      : "Preflight verified. Ready to launch.",
  };
});
</script>

<template>
  <header class="flex shrink-0 flex-col gap-2.5 border-b border-hairline bg-base-200 px-4 py-2.5">
    <!-- ROW 1: Model & Recipe Selection (Left) + Mode Switcher (Right) -->
    <div class="flex flex-wrap items-center justify-between gap-3 w-full">
      <!-- Left: Model & Recipe Dropdowns -->
      <div class="flex flex-wrap items-center gap-3 min-w-0">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs font-bold uppercase tracking-wider text-muted"> Model </span>
          <BaseSelect
            :model-value="composerStore.family"
            class="min-w-44 font-semibold"
            @update:model-value="composerStore.selectFamily(String($event))"
          >
            <option v-for="fam in schemaStore.families" :key="fam.key" :value="fam.key">
              {{ fam.gui_label || fam.display_name }}
            </option>
          </BaseSelect>
        </div>

        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xs font-bold uppercase tracking-wider text-muted shrink-0">
            Recipe
          </span>
          <BaseSelect
            :model-value="composerStore.presetName"
            class="w-72 sm:w-80 lg:w-96 truncate"
            @update:model-value="composerStore.applyPreset(String($event))"
          >
            <optgroup label="Curated Recipes">
              <option
                v-for="p in composerStore.currentFamilyDesc?.form.presets ?? []"
                :key="p.name"
                :value="p.name"
              >
                {{ p.name }}
              </option>
            </optgroup>
            <optgroup v-if="composerStore.userPresets.length > 0" label="User Presets">
              <option v-for="up in composerStore.userPresets" :key="up" :value="up">
                {{ up }}
              </option>
            </optgroup>
          </BaseSelect>

          <!-- Reset modified badge -->
          <BaseButton
            v-if="composerStore.modifiedKeys.size > 0"
            variant="outline"
            class="border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-content shrink-0"
            title="Reset all customized parameters back to recipe defaults"
            @click="composerStore.resetAllToPreset()"
          >
            <template #icon-left><RotateCcw class="h-3.5 w-3.5" /></template>
            <span>Reset ({{ composerStore.modifiedKeys.size }})</span>
          </BaseButton>
        </div>
      </div>

      <!-- Right: Progressive Disclosure Mode Switcher -->
      <BasePillGroup class="shrink-0">
        <BaseButton
          size="pill"
          :active="mode === 'essential'"
          @click="emit('update:mode', 'essential')"
        >
          <template #icon-left><Sparkles class="h-3.5 w-3.5" /></template>
          <span>Essential Studio</span>
        </BaseButton>
        <BaseButton size="pill" :active="mode === 'expert'" @click="emit('update:mode', 'expert')">
          <template #icon-left><Sliders class="h-3.5 w-3.5" /></template>
          <span>Expert Tuning</span>
          <span
            v-if="composerStore.modifiedKeys.size > 0"
            class="badge badge-xs badge-warning font-mono ml-0.5"
          >
            {{ composerStore.modifiedKeys.size }}
          </span>
        </BaseButton>
      </BasePillGroup>
    </div>

    <!-- ROW 2: Action Buttons (Left) + Right-Aligned Status / Preflight Warning Banner along the same line -->
    <div class="flex items-center justify-between gap-3 w-full border-t border-hairline/60 pt-2">
      <!-- Left: Check Plan, Add to Queue, Start Training -->
      <div class="flex items-center gap-2 shrink-0">
        <BaseButton
          variant="outline"
          class="border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-bold shadow-xs"
          :disabled="composerStore.validatingPlan"
          @click="emit('validate-plan')"
        >
          <template #icon-left><ShieldCheck class="h-4 w-4 shrink-0" /></template>
          <span>Check Plan</span>
        </BaseButton>

        <BaseButton
          :variant="runStore.isActiveOrStarting && canProcess ? 'primary' : 'outline'"
          class="border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-bold shadow-xs"
          :class="{ 'text-primary-content': runStore.isActiveOrStarting && canProcess }"
          :disabled="!canProcess"
          :title="
            !canProcess
              ? 'Selected dataset is not completely tagged — captions required for all images'
              : 'Add this training configuration to the background queue'
          "
          @click="emit('queue-run')"
        >
          <template #icon-left><ListPlus class="h-4 w-4 shrink-0" /></template>
          <span>Add to Queue</span>
        </BaseButton>

        <BaseButton
          variant="primary"
          class="font-bold shadow-sm"
          :disabled="!canProcess || runStore.isActiveOrStarting"
          :title="
            !canProcess
              ? 'Selected dataset is not completely tagged — captions required for all images'
              : runStore.isActiveOrStarting
                ? 'A training run is currently active on the GPU — use Add to Queue instead'
                : 'Validate and start training now'
          "
          @click="emit('start-run')"
        >
          <template #icon-left><Play class="h-4 w-4 fill-current shrink-0" /></template>
          <span>Start Training</span>
        </BaseButton>
      </div>

      <!-- Right: Right-Aligned Status / Preflight Warning Banner along the same line! -->
      <div class="flex items-center justify-end min-w-0">
        <div
          v-if="headerStatusMessage.kind === 'warning'"
          class="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning shadow-xs"
        >
          <AlertTriangle class="h-4 w-4 shrink-0 text-warning" />
          <div class="flex items-center gap-1.5 truncate">
            <strong class="font-bold shrink-0">{{ headerStatusMessage.title }}:</strong>
            <span class="truncate">{{ headerStatusMessage.text }}</span>
          </div>
        </div>

        <div
          v-else-if="headerStatusMessage.kind === 'info'"
          class="flex items-center gap-2 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs text-info shadow-xs"
        >
          <Info class="h-4 w-4 shrink-0 text-info" />
          <div class="flex items-center gap-1.5 truncate">
            <strong class="font-bold shrink-0">{{ headerStatusMessage.title }}:</strong>
            <span class="truncate">{{ headerStatusMessage.text }}</span>
          </div>
        </div>

        <div
          v-else
          class="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-xs text-success shadow-xs"
        >
          <CheckCircle2 class="h-4 w-4 shrink-0 text-success" />
          <div class="flex items-center gap-1.5 truncate">
            <strong class="font-bold shrink-0">{{ headerStatusMessage.title }}:</strong>
            <span class="truncate font-mono">{{ headerStatusMessage.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
