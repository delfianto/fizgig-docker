<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FolderOpen,
  ListPlus,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wand2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type SchemaRow } from "@shared/types";
import SchemaField from "@/components/schema/SchemaField.vue";
import { useComposerStore } from "@/stores/composer";
import { usePlanOverlayStore } from "@/stores/overlay";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";

const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();
const runStore = useRunStore();
const planOverlay = usePlanOverlayStore();

// Progressive Disclosure Mode: Essential (clean 80/20) vs Expert (full 35+ knobs)
const composerMode = ref<"essential" | "expert">(
  (localStorage.getItem("fizgig.ui.composerMode") as "essential" | "expert") || "essential",
);

watch(composerMode, (val) => {
  localStorage.setItem("fizgig.ui.composerMode", val);
});

// Expert Tab Navigation
export type ExpertTab =
  | "network"
  | "optimizer"
  | "resolution"
  | "automation"
  | "previews"
  | "memory"
  | "advanced";

const expertTab = ref<ExpertTab>("network");
const paramFilter = ref("");

const rowMap = computed(() => schemaStore.getRowMap(composerStore.family));

function row(key: string): SchemaRow | undefined {
  const r = rowMap.value.get(key);
  if (!r) return undefined;
  if (composerStore.formState.hidden?.includes(key)) return undefined;
  return r;
}

// Categorized keys for Expert Mode Tabs
const EXPERT_GROUPS: Record<ExpertTab, { title: string; keys: string[] }> = {
  network: {
    title: "Network Architecture & Rank",
    keys: [
      "FAMILY_KIND",
      "NETWORK_TYPE",
      "NETWORK_DIM",
      "NETWORK_ALPHA",
      "LOKR_FACTOR",
      "SEED",
      "FAMILY_EMA",
      "CONTEXT_LORA_PATH",
      "CONTEXT_LORA_STRENGTH",
    ],
  },
  optimizer: {
    title: "Learning Rate & Optimizer",
    keys: [
      "ADAPTIVE_LR",
      "LEARNING_RATE",
      "ADAPTIVE_LR_MIN",
      "ADAPTIVE_LR_MAX",
      "OPTIMIZER_TYPE",
      "LR_SCHEDULER",
      "LR_WARMUP_STEPS",
      "GRADIENT_ACCUMULATION",
      "MAX_GRAD_NORM",
      "OPTIMIZER_ARGS",
    ],
  },
  resolution: {
    title: "Resolution, Batching & Bucketing",
    keys: [
      "DATASET_MEGAPIXELS",
      "BATCH_SIZE",
      "STAGE_MP",
      "STAGE_UNTIL",
      "ENABLE_BUCKET",
      "BUCKET_NO_UPSCALE",
      "TRAIN_SUBFOLDERS",
    ],
  },
  automation: {
    title: "Loss Watching & Recaptioning",
    keys: [
      "KREA2_LOSS_WATCH",
      "KREA2_PER_IMAGE_LR",
      "KREA2_WARMUP_LOOK",
      "KREA2_AUTO_RECAPTION",
      "RECAPTION_FIRST",
      "RECAPTION_SECOND",
    ],
  },
  previews: {
    title: "Validation Previews (Draft)",
    keys: [
      "SAMPLE_ENABLED",
      "SAMPLE_AT_FIRST",
      "SAMPLE_EVERY_N_EPOCHS",
      "SAMPLE_WIDTH",
      "SAMPLE_HEIGHT",
      "SAMPLE_STEPS",
      "SAMPLE_CFG_SCALE",
      "SAMPLE_SEED",
      "FAMILY_TURBO_STRENGTH",
      "SAMPLE_PROMPT",
      "SAMPLE_NEGATIVE",
      "SAMPLE_REFERENCE",
    ],
  },
  memory: {
    title: "Memory, Precision & States",
    keys: [
      "FAMILY_PRECISION",
      "BLOCKS_SWAP",
      "COMPILE_BLOCKS",
      "ENABLE_CACHE",
      "SAVE_STATE",
      "SAVE_STATE_ON_TRAIN_END",
      "KEEP_LAST_N_STATES",
      "RESUME_TRAINING",
    ],
  },
  advanced: {
    title: "Masks, Metadata & Extensions",
    keys: [
      "MASKED_TRAINING",
      "MASK_FLOOR",
      "MASK_PRIOR",
      "CAPTION_DROPOUT",
      "DATASET_CAPTION_EXT",
      "METADATA_TITLE",
      "METADATA_AUTHOR",
      "METADATA_DESCRIPTION",
      "METADATA_LICENSE",
      "METADATA_TAGS",
      "METADATA_TRIGGER_PHRASE",
      "METADATA_THUMBNAIL",
    ],
  },
};

const selectedDatasetInfo = computed(() =>
  schemaStore.datasets.find((d) => d.path === composerStore.imageFolder),
);

// Count how many keys in an expert tab are modified from preset
function modifiedCountInTab(tab: ExpertTab): number {
  const keys = EXPERT_GROUPS[tab].keys;
  let count = 0;
  for (const k of keys) {
    if (composerStore.modifiedKeys.has(k)) {
      count++;
    }
  }
  return count;
}

const currentPresetNote = computed(() => {
  const fam = composerStore.currentFamilyDesc;
  if (!fam?.preset_notes) return null;
  return fam.preset_notes[composerStore.presetName] ?? null;
});

function autoSuggestLoraName(): void {
  const ds = selectedDatasetInfo.value?.name;
  if (!ds) return;
  const famKey = composerStore.family.replace(/[^a-z0-9]/gi, "").toLowerCase();
  composerStore.draftValues.LORA_NAME = `${ds}_${famKey}_v1`;
  if (!composerStore.draftValues.CAPTION_TRIGGER_WORD) {
    const token = ds.split(/[_-]/)[0];
    if (token && token.length > 1) {
      composerStore.draftValues.CAPTION_TRIGGER_WORD = token;
      void composerStore.checkTriggerWord();
    }
  }
  toast.success(`Generated LoRA name: ${composerStore.draftValues.LORA_NAME}`);
}

function selectDataset(path: string): void {
  composerStore.imageFolder = path;
  composerStore.refreshFormState();
  if (!composerStore.draftValues.LORA_NAME || composerStore.draftValues.LORA_NAME === "my_lora") {
    autoSuggestLoraName();
  }
}

function setQuickEpochs(n: number): void {
  composerStore.draftValues.MAX_TRAIN_EPOCHS = n;
  composerStore.refreshFormState();
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
        status: "attention",
        title: hasProblems ? "Plan Blockers Detected" : "Plan Advisory Warnings",
        problems: res.problems ?? [],
        warnings: res.warnings ?? [],
        duration: 6500,
      });
    }
  } catch (err) {
    planOverlay.show({
      status: "attention",
      title: "Plan Validation Error",
      message: err instanceof Error ? err.message : "Plan validation failed",
      duration: 6500,
    });
  }
}

async function handleQueueRun(): Promise<void> {
  try {
    const res = await composerStore.submitQueueTraining();
    if (res.problems && res.problems.length > 0) {
      planOverlay.show({
        status: "attention",
        title: "Cannot Queue: Blockers Detected",
        problems: res.problems,
        warnings: res.warnings ?? [],
        duration: 6500,
      });
      return;
    }
    toast.success(`Added "${composerStore.draftValues.LORA_NAME}" to queue`);
    await runStore.pollRun();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Queue submission failed");
  }
}

async function handleStartRun(): Promise<void> {
  try {
    const res = await composerStore.submitStartTraining();
    if ((res.problems && res.problems.length > 0) || (res.warnings && res.warnings.length > 0)) {
      planOverlay.show({
        status: "attention",
        title: "Cannot Start: Attention Needed",
        problems: res.problems ?? [],
        warnings: res.warnings ?? [],
        duration: 6500,
      });
      return;
    }
    toast.success(`Started training "${composerStore.draftValues.LORA_NAME}"`);
    await runStore.pollRun();
    void router.push("/cockpit");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Start training failed");
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
    <header
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-base-200 px-4 py-2.5"
    >
      <!-- Left: Model Family & Recipe Preset -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-muted"> Model </span>
          <select
            :value="composerStore.family"
            class="select select-sm border-hairline-strong bg-base-300 text-xs font-semibold text-base-content min-w-44"
            @change="composerStore.selectFamily(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="fam in schemaStore.families" :key="fam.key" :value="fam.key">
              {{ fam.gui_label || fam.display_name }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-muted"> Recipe </span>
          <select
            :value="composerStore.presetName"
            class="select select-sm border-hairline-strong bg-base-300 text-xs text-base-content w-80 lg:w-[420px]"
            @change="composerStore.applyPreset(($event.target as HTMLSelectElement).value)"
          >
            <optgroup label="Curated Recipes">
              <option
                v-for="p in composerStore.currentFamilyDesc?.form.presets ?? []"
                :key="p.name"
                :value="p.name"
              >
                ✨ {{ p.name }}
              </option>
            </optgroup>
            <optgroup v-if="composerStore.userPresets.length > 0" label="User Presets">
              <option v-for="up in composerStore.userPresets" :key="up" :value="up">
                {{ up }}
              </option>
            </optgroup>
          </select>

          <!-- Reset modified badge -->
          <button
            v-if="composerStore.modifiedKeys.size > 0"
            type="button"
            class="btn btn-xs border border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-content"
            title="Reset all customized parameters back to recipe defaults"
            @click="composerStore.resetAllToPreset()"
          >
            <RotateCcw class="h-3 w-3" />
            Reset ({{ composerStore.modifiedKeys.size }} modified)
          </button>
        </div>
      </div>

      <!-- Center: Progressive Disclosure Mode Switcher -->
      <div class="join border border-hairline-strong bg-base-300 p-0.5 rounded-md">
        <button
          type="button"
          class="btn btn-xs join-item border-0 gap-1.5 px-3"
          :class="
            composerMode === 'essential'
              ? 'bg-primary text-primary-content font-bold'
              : 'btn-ghost text-subtle'
          "
          @click="composerMode = 'essential'"
        >
          <Sparkles class="h-3.5 w-3.5" />
          <span>Essential Studio</span>
        </button>
        <button
          type="button"
          class="btn btn-xs join-item border-0 gap-1.5 px-3"
          :class="
            composerMode === 'expert'
              ? 'bg-primary text-primary-content font-bold'
              : 'btn-ghost text-subtle'
          "
          @click="composerMode = 'expert'"
        >
          <Sliders class="h-3.5 w-3.5" />
          <span>Expert Tuning</span>
          <span
            v-if="composerStore.modifiedKeys.size > 0"
            class="badge badge-xs badge-warning font-mono"
          >
            {{ composerStore.modifiedKeys.size }}
          </span>
        </button>
      </div>

      <!-- Right: Preflight & Launch Buttons -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-sm btn-ghost border border-hairline-strong bg-base-300 text-xs gap-1.5"
          :disabled="composerStore.validatingPlan"
          @click="handleValidatePlan"
        >
          <ShieldCheck class="h-4 w-4 text-info" />
          <span>Check Plan</span>
        </button>

        <button
          type="button"
          class="btn btn-sm border border-hairline-strong bg-base-300 text-xs hover:border-primary gap-1.5"
          :class="{ 'btn-primary': runStore.isActiveOrStarting }"
          @click="handleQueueRun"
        >
          <ListPlus class="h-4 w-4" />
          <span>Add to Queue</span>
        </button>

        <button
          type="button"
          class="btn btn-sm btn-primary text-xs gap-1.5 font-bold"
          :disabled="runStore.isActiveOrStarting"
          :title="
            runStore.isActiveOrStarting
              ? 'A training run is currently active on the GPU — use Add to Queue instead'
              : 'Validate and start training now'
          "
          @click="handleStartRun"
        >
          <Play class="h-4 w-4 fill-current" />
          <span>Start Training</span>
        </button>
      </div>
    </header>

    <!-- VIEW A: ESSENTIAL STUDIO (Clean 80/20 Workflow) -->
    <main v-if="composerMode === 'essential'" class="flex-1 overflow-y-auto p-5">
      <div class="mx-auto max-w-6xl grid grid-cols-1 gap-6 lg:grid-cols-12">
        <!-- LEFT COLUMN (7 cols): Data, Recipe Summary, and Schedule -->
        <div class="flex flex-col gap-5 lg:col-span-7">
          <!-- Card 1: Dataset & Output Identity -->
          <section class="rounded-xl border border-hairline bg-base-300/80 p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-hairline pb-3">
              <div class="flex items-center gap-2">
                <FolderOpen class="h-4 w-4 text-primary" />
                <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                  Training Dataset & Output
                </h2>
              </div>
              <span v-if="selectedDatasetInfo" class="badge badge-success badge-sm font-mono gap-1">
                {{ selectedDatasetInfo.count }} pictures ready
              </span>
            </div>

            <!-- Dataset Picker Grid -->
            <div>
              <label class="mb-1.5 block text-xs font-semibold text-subtle">
                Select Dataset Folder:
              </label>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  v-for="ds in schemaStore.datasets"
                  :key="ds.path"
                  type="button"
                  class="flex flex-col items-start rounded-lg border p-2.5 text-left transition"
                  :class="
                    composerStore.imageFolder === ds.path
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-hairline bg-base-200/70 text-base-content hover:border-hairline-strong'
                  "
                  @click="selectDataset(ds.path)"
                >
                  <span class="truncate font-semibold text-xs">{{ ds.name }}</span>
                  <span class="font-mono text-[11px] text-muted"> {{ ds.count }} images </span>
                </button>
              </div>
            </div>

            <!-- LoRA Name & Trigger Word Inputs -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div class="mb-1.5 flex items-center justify-between">
                  <label class="text-xs font-semibold text-subtle">LoRA Name</label>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost gap-1 text-[11px] text-primary"
                    title="Auto-generate from dataset name"
                    @click="autoSuggestLoraName"
                  >
                    <Wand2 class="h-3 w-3" />
                    Auto-name
                  </button>
                </div>
                <input
                  :value="String(composerStore.draftValues.LORA_NAME ?? '')"
                  type="text"
                  placeholder="e.g. jeje_krea2_v1"
                  class="input input-sm w-full border-hairline-strong bg-base-100 font-mono text-sm text-base-content focus:border-primary"
                  @input="
                    composerStore.setFieldValue(
                      'LORA_NAME',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>

              <div>
                <div class="mb-1.5 flex items-center justify-between">
                  <label class="text-xs font-semibold text-subtle">Trigger Word</label>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost gap-1 text-[11px] text-primary"
                    @click="composerStore.checkTriggerWord()"
                  >
                    <Sparkles class="h-3 w-3" />
                    Inspect Tokenizer
                  </button>
                </div>
                <input
                  :value="String(composerStore.draftValues.CAPTION_TRIGGER_WORD ?? '')"
                  type="text"
                  placeholder="e.g. jeje"
                  class="input input-sm w-full border-hairline-strong bg-base-100 font-mono text-sm text-base-content focus:border-primary"
                  @input="
                    composerStore.setFieldValue(
                      'CAPTION_TRIGGER_WORD',
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                  @blur="composerStore.checkTriggerWord()"
                />
                <div
                  v-if="composerStore.triggerCheckVerdict"
                  class="mt-1 flex items-center gap-1.5 font-mono text-xs"
                  :class="composerStore.triggerCheckVerdict.ok ? 'text-success' : 'text-warning'"
                >
                  <CheckCircle2 v-if="composerStore.triggerCheckVerdict.ok" class="h-3.5 w-3.5" />
                  <AlertTriangle v-else class="h-3.5 w-3.5" />
                  <span>
                    {{ composerStore.triggerCheckVerdict.tokens }} token(s):
                    {{ composerStore.triggerCheckVerdict.text }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <!-- Card 2: Curated Recipe Summary -->
          <section class="rounded-xl border border-hairline bg-base-300/80 p-5 space-y-3">
            <div class="flex items-center justify-between border-b border-hairline pb-3">
              <div class="flex items-center gap-2">
                <Sparkles class="h-4 w-4 text-secondary" />
                <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                  Active Recipe: {{ composerStore.presetName }}
                </h2>
              </div>
              <button
                type="button"
                class="btn btn-xs btn-outline border-hairline text-xs"
                @click="composerMode = 'expert'"
              >
                Customize Under the Hood ↗
              </button>
            </div>

            <p v-if="currentPresetNote" class="text-xs text-subtle leading-relaxed">
              {{ currentPresetNote }}
            </p>

            <!-- Curated Parameter Badges -->
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
              <div class="rounded-lg border border-hairline bg-base-200/60 p-2.5">
                <span class="text-[11px] text-muted block">Network Rank</span>
                <span class="font-mono text-sm font-bold text-base-content">
                  Dim {{ composerStore.draftValues.NETWORK_DIM ?? 16 }} / Alpha
                  {{ composerStore.draftValues.NETWORK_ALPHA ?? 16 }}
                </span>
              </div>

              <div class="rounded-lg border border-hairline bg-base-200/60 p-2.5">
                <span class="text-[11px] text-muted block">Optimizer</span>
                <span class="font-mono text-sm font-bold text-primary uppercase">
                  {{ composerStore.draftValues.OPTIMIZER_TYPE || "Muon" }}
                </span>
              </div>

              <div class="rounded-lg border border-hairline bg-base-200/60 p-2.5">
                <span class="text-[11px] text-muted block">Learning Rate</span>
                <span class="font-mono text-sm font-bold text-warning">
                  {{
                    composerStore.draftValues.ADAPTIVE_LR
                      ? "Adaptive"
                      : composerStore.draftValues.LEARNING_RATE || "1e-4"
                  }}
                </span>
              </div>

              <div class="rounded-lg border border-hairline bg-base-200/60 p-2.5">
                <span class="text-[11px] text-muted block">Resolution</span>
                <span class="font-mono text-sm font-bold text-base-content">
                  {{ composerStore.draftValues.DATASET_MEGAPIXELS || "1.0" }} MP
                </span>
              </div>
            </div>
          </section>

          <!-- Card 3: Training Schedule -->
          <section class="rounded-xl border border-hairline bg-base-300/80 p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-hairline pb-3">
              <div class="flex items-center gap-2">
                <Clock class="h-4 w-4 text-warning" />
                <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                  Training Schedule
                </h2>
              </div>
              <span class="text-xs text-muted">
                Higher epochs capture subtle traits; fewer epochs prevent overfitting.
              </span>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-subtle"> Total Training Epochs: </label>
                <div class="flex items-center gap-1.5">
                  <button
                    v-for="ep in [15, 30, 50, 75]"
                    :key="ep"
                    type="button"
                    class="btn btn-xs"
                    :class="
                      Number(composerStore.draftValues.MAX_TRAIN_EPOCHS) === ep
                        ? 'btn-primary'
                        : 'btn-ghost border border-hairline'
                    "
                    @click="setQuickEpochs(ep)"
                  >
                    {{ ep }}
                  </button>
                  <input
                    :value="Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30)"
                    type="number"
                    min="1"
                    max="300"
                    class="input input-sm w-16 border-hairline-strong bg-base-100 font-mono text-center font-bold text-base-content"
                    @input="
                      composerStore.setFieldValue(
                        'MAX_TRAIN_EPOCHS',
                        Number(($event.target as HTMLInputElement).value),
                      )
                    "
                  />
                </div>
              </div>

              <input
                :value="Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30)"
                type="range"
                min="5"
                max="100"
                step="1"
                class="range range-xs range-primary w-full"
                @input="
                  composerStore.setFieldValue(
                    'MAX_TRAIN_EPOCHS',
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />

              <div class="flex items-center justify-between pt-1">
                <label class="text-xs font-semibold text-subtle"> Save Checkpoint Cadence: </label>
                <span class="font-mono text-xs text-base-content">
                  Every {{ composerStore.draftValues.SAVE_EVERY_N_EPOCHS ?? 1 }} epoch(s)
                </span>
              </div>
            </div>
          </section>
        </div>

        <!-- RIGHT COLUMN (5 cols): Preview Prompts & Preflight Launch Center -->
        <div class="flex flex-col gap-5 lg:col-span-5">
          <!-- Card 4: Validation Preview Prompts -->
          <section class="rounded-xl border border-hairline bg-base-300/80 p-5 space-y-3">
            <div class="flex items-center justify-between border-b border-hairline pb-3">
              <div class="flex items-center gap-2">
                <Eye class="h-4 w-4 text-info" />
                <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                  Sample Prompts (Draft)
                </h2>
              </div>
              <span class="badge badge-xs badge-info font-mono">Isolated from live run</span>
            </div>

            <p class="text-xs text-subtle">
              Test prompts generated at each checkpoint to evaluate likeness and flexibility:
            </p>

            <textarea
              :value="String(composerStore.draftValues.SAMPLE_PROMPT ?? '')"
              rows="6"
              placeholder="A close-up portrait of trigger, looking at camera, neutral background..."
              class="textarea textarea-bordered w-full border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed text-base-content focus:border-primary"
              @input="
                composerStore.setFieldValue(
                  'SAMPLE_PROMPT',
                  ($event.target as HTMLTextAreaElement).value,
                )
              "
            />

            <div class="flex items-center justify-between text-xs text-muted">
              <span>Separate multiple prompts with a blank line.</span>
              <span
                >Renders every
                {{ composerStore.draftValues.SAMPLE_EVERY_N_EPOCHS ?? 1 }} epoch</span
              >
            </div>
          </section>

          <!-- Card 5: Preflight Check & Launch Station -->
          <section class="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-hairline pb-3">
              <div class="flex items-center gap-2">
                <ShieldCheck class="h-4 w-4 text-primary" />
                <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                  Preflight & Launch Station
                </h2>
              </div>
              <span class="badge badge-sm badge-success font-semibold">Ready</span>
            </div>

            <!-- Health Checklist -->
            <div class="space-y-2 text-xs">
              <div class="flex items-center justify-between rounded bg-base-300/60 px-3 py-2">
                <span class="text-subtle">Selected Dataset:</span>
                <span class="font-mono font-semibold text-base-content">
                  {{ composerStore.imageFolder || "None selected" }}
                </span>
              </div>

              <div class="flex items-center justify-between rounded bg-base-300/60 px-3 py-2">
                <span class="text-subtle">Compute Device:</span>
                <span class="font-mono font-semibold text-primary">
                  {{ runStore.stats?.device_name || "NVIDIA RTX 4080" }}
                </span>
              </div>

              <div class="flex items-center justify-between rounded bg-base-300/60 px-3 py-2">
                <span class="text-subtle">Estimated VRAM:</span>
                <span class="font-mono font-semibold text-success">
                  ~11.8 GB / 16.0 GB (Comfortable)
                </span>
              </div>
            </div>

            <!-- Main Launch Actions -->
            <div class="space-y-2 pt-2">
              <button
                type="button"
                class="btn btn-primary w-full gap-2 font-bold text-sm shadow-lg"
                :disabled="runStore.isActiveOrStarting"
                @click="handleStartRun"
              >
                <Play class="h-4 w-4 fill-current" />
                Start Training Run Now
              </button>

              <button
                type="button"
                class="btn btn-ghost border border-hairline-strong w-full gap-2 text-xs"
                @click="handleQueueRun"
              >
                <ListPlus class="h-4 w-4" />
                Add to Background Training Queue
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>

    <!-- VIEW B: EXPERT TUNING (Organized Tabbed Bays for 35+ Knobs) -->
    <main v-else class="flex-1 overflow-hidden grid grid-cols-[240px_1fr]">
      <!-- Expert Left Category Tabs -->
      <aside
        class="flex flex-col border-r border-hairline bg-base-200/50 p-2.5 space-y-1 overflow-y-auto"
      >
        <div class="mb-2 px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Expert Parameters
        </div>

        <button
          v-for="(grp, tabKey) in EXPERT_GROUPS"
          :key="tabKey"
          type="button"
          class="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition"
          :class="
            expertTab === tabKey
              ? 'bg-primary text-primary-content font-bold shadow'
              : 'text-subtle hover:bg-base-300'
          "
          @click="expertTab = tabKey"
        >
          <span class="truncate">{{ grp.title }}</span>
          <span
            v-if="modifiedCountInTab(tabKey) > 0"
            class="badge badge-xs font-mono"
            :class="expertTab === tabKey ? 'badge-warning' : 'badge-primary'"
          >
            {{ modifiedCountInTab(tabKey) }}
          </span>
        </button>
      </aside>

      <!-- Expert Main Parameter Form Panel -->
      <section class="flex flex-col overflow-hidden bg-base-100">
        <!-- Sub-header with Filter Search -->
        <div
          class="flex items-center justify-between border-b border-hairline bg-base-200/40 px-5 py-2.5"
        >
          <div>
            <h2 class="text-sm font-bold text-base-content">
              {{ EXPERT_GROUPS[expertTab].title }}
            </h2>
            <p class="text-xs text-muted">
              Fine-tune underlying hyperparameters while preserving recipe baseline defaults.
            </p>
          </div>

          <div class="relative w-64">
            <Search class="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              v-model="paramFilter"
              type="text"
              placeholder="Search parameter key..."
              class="input input-xs input-bordered w-full bg-base-300/60 pl-8 text-xs font-mono"
            />
          </div>
        </div>

        <!-- Render Parameter Fields in Clean Grid -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="mx-auto max-w-4xl space-y-4">
            <div
              v-for="k in EXPERT_GROUPS[expertTab].keys"
              :key="k"
              class="rounded-lg border border-hairline bg-base-200/60 p-3.5 transition-colors hover:border-hairline-strong"
              :class="{
                hidden: paramFilter && !k.toLowerCase().includes(paramFilter.toLowerCase()),
              }"
            >
              <SchemaField v-if="row(k)" :row="row(k)!" />
              <div v-else class="flex items-center justify-between text-xs text-muted">
                <span class="font-mono">{{ k }}</span>
                <span class="badge badge-xs">Not applicable to {{ composerStore.family }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
