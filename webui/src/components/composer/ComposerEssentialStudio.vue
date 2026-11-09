<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  Folder,
  FolderCheck,
  FolderOpen,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";

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
  (e: "switch-to-expert"): void;
  (e: "select-dataset", path: string): void;
  (e: "auto-name"): void;
  (e: "set-quick-epochs", epochs: number): void;
}>();

const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();
const runStore = useRunStore();

const datasetFilter = ref("");

function isDatasetCompletelyTagged(ds: DatasetSummary | null | undefined): boolean {
  if (!ds) return false;
  const count = ds.count ?? ds.pictures ?? 0;
  if (count <= 0) return false;
  const captioned = ds.captioned ?? 0;
  return captioned >= count;
}

const isSelectedDatasetReady = computed(() => {
  return isDatasetCompletelyTagged(props.selectedDatasetInfo);
});

const filteredDatasets = computed(() => {
  const query = datasetFilter.value.trim().toLowerCase();
  if (!query) return schemaStore.datasets;
  return schemaStore.datasets.filter(
    (d) => d.name.toLowerCase().includes(query) || d.path.toLowerCase().includes(query),
  );
});

const samplePromptCount = computed(() => {
  const text = String(composerStore.draftValues.SAMPLE_PROMPT ?? "").trim();
  if (!text) return 0;
  return text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
});

function onSelectDataset(path: string): void {
  composerStore.setImageFolder(path);
  emit("select-dataset", path);
}
</script>

<template>
  <main class="flex-1 overflow-y-auto p-2.5 sm:p-3">
    <div class="mx-auto max-w-6xl grid grid-cols-1 gap-2.5 lg:grid-cols-12">
      <!-- LEFT COLUMN (7 cols): Data, Recipe Summary, and Schedule -->
      <div class="flex flex-col gap-2.5 lg:col-span-7">
        <!-- Card 1: Dataset & Output Identity -->
        <section class="rounded-xl border border-hairline bg-base-300/80 p-2.5 space-y-2">
          <div class="flex items-center justify-between border-b border-hairline pb-1.5">
            <div class="flex items-center gap-2">
              <FolderOpen class="h-4 w-4 text-primary" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-base-content">
                Training Dataset &amp; Output
              </h2>
            </div>
            <span
              v-if="selectedDatasetInfo"
              class="badge badge-sm font-mono gap-1"
              :class="isSelectedDatasetReady ? 'badge-success' : 'badge-warning'"
            >
              {{
                isSelectedDatasetReady
                  ? `${selectedDatasetInfo.count} pictures ready`
                  : `${selectedDatasetInfo.captioned ?? 0}/${selectedDatasetInfo.count} tagged (incomplete)`
              }}
            </span>
          </div>

          <!-- Dataset Picker: Scrollable List with Search & Tagging Verification -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-subtle"> Select Dataset Folder: </label>
              <div class="relative w-44">
                <Search
                  class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
                />
                <input
                  v-model="datasetFilter"
                  type="text"
                  placeholder="Filter datasets..."
                  class="input input-xs pl-7 w-full border-hairline bg-base-100 text-xs text-base-content focus:border-primary"
                />
              </div>
            </div>

            <!-- Scrollable list of dataset folders (compact max-h-28 for no-scroll fit) -->
            <div
              class="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-hairline bg-base-200/50 p-1 scrollbar-thin"
            >
              <div v-if="filteredDatasets.length === 0" class="py-4 text-center text-xs text-muted">
                No datasets matching "{{ datasetFilter }}"
              </div>
              <button
                v-for="ds in filteredDatasets"
                :key="ds.path"
                type="button"
                class="flex w-full items-center justify-between gap-2.5 rounded-md border p-1.5 text-left transition cursor-pointer select-none"
                :class="
                  composerStore.imageFolder === ds.path
                    ? 'border-primary bg-primary/15 text-base-content shadow-sm ring-1 ring-primary/40'
                    : 'border-hairline bg-base-100/70 text-base-content hover:border-hairline-strong hover:bg-base-100'
                "
                @click="onSelectDataset(ds.path)"
              >
                <!-- Left: Radio & Icon & Names -->
                <div class="flex items-center gap-2 min-w-0">
                  <input
                    type="radio"
                    name="dataset_selection"
                    :checked="composerStore.imageFolder === ds.path"
                    class="radio radio-primary radio-xs pointer-events-none shrink-0"
                  />
                  <div
                    class="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    :class="
                      isDatasetCompletelyTagged(ds)
                        ? 'bg-success/15 text-success'
                        : 'bg-warning/15 text-warning'
                    "
                  >
                    <FolderCheck v-if="isDatasetCompletelyTagged(ds)" class="h-3.5 w-3.5" />
                    <Folder v-else class="h-3.5 w-3.5" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-xs truncate">{{ ds.name }}</span>
                      <span
                        v-if="composerStore.imageFolder === ds.path"
                        class="badge badge-xs badge-primary font-mono text-[9px] px-1 py-0 h-4"
                      >
                        Selected
                      </span>
                    </div>
                    <span
                      class="font-mono text-[10px] text-muted truncate block max-w-xs sm:max-w-sm"
                    >
                      {{ ds.path }}
                    </span>
                  </div>
                </div>

                <!-- Right: Uniform Badges (identical sizes for all rows) -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <span
                    class="badge badge-sm badge-neutral font-mono text-[11px] h-6 px-2 w-20 justify-center shrink-0"
                  >
                    {{ ds.count }} imgs
                  </span>
                  <span
                    v-if="isDatasetCompletelyTagged(ds)"
                    class="badge badge-sm badge-success font-mono text-[11px] h-6 px-2 w-28 justify-center gap-1 shrink-0"
                  >
                    <CheckCircle2 class="h-3 w-3 shrink-0" />
                    100% Tagged
                  </span>
                  <span
                    v-else
                    class="badge badge-sm badge-warning font-mono text-[11px] h-6 px-2 w-28 justify-center gap-1 shrink-0"
                  >
                    <AlertTriangle class="h-3 w-3 shrink-0" />
                    {{ ds.captioned ?? 0 }}/{{ ds.count }} Tagged
                  </span>
                </div>
              </button>
            </div>

            <!-- Incomplete Dataset Warning Callout (shown only when selected dataset is incomplete) -->
            <div
              v-if="selectedDatasetInfo && !isSelectedDatasetReady"
              class="flex items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning"
            >
              <div class="flex items-center gap-1.5 truncate">
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">
                  Incomplete captions:
                  <strong
                    >{{ selectedDatasetInfo.captioned ?? 0 }}/{{
                      selectedDatasetInfo.count
                    }}</strong
                  >
                  tagged. 100% required.
                </span>
              </div>
              <button
                type="button"
                class="btn btn-xs btn-warning btn-outline h-5 min-h-0 px-2 text-[10px] shrink-0 cursor-pointer"
                @click="router.push('/datasets')"
              >
                <span>Caption Studio</span>
                <ArrowRight class="h-2.5 w-2.5" />
              </button>
            </div>
          </div>

          <!-- LoRA Name & Trigger Word Inputs -->
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-0.5">
            <div>
              <div class="mb-1 flex items-center justify-between">
                <label class="text-xs font-semibold text-subtle">LoRA Name</label>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost gap-1 text-[11px] text-primary h-5 min-h-0 px-1.5"
                  title="Auto-generate from dataset name"
                  @click="emit('auto-name')"
                >
                  <Wand2 class="h-3 w-3" />
                  Auto-name
                </button>
              </div>
              <input
                :value="String(composerStore.draftValues.LORA_NAME ?? '')"
                type="text"
                placeholder="e.g. jeje_krea2_v1"
                class="input input-sm w-full border-hairline-strong bg-base-100 font-mono text-xs text-base-content focus:border-primary"
                @input="
                  composerStore.setFieldValue(
                    'LORA_NAME',
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </div>

            <div>
              <div class="mb-1 flex items-center justify-between">
                <label class="text-xs font-semibold text-subtle">Trigger Word</label>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost gap-1 text-[11px] text-primary h-5 min-h-0 px-1.5"
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
                class="input input-sm w-full border-hairline-strong bg-base-100 font-mono text-xs text-base-content focus:border-primary"
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
                class="mt-1 flex items-center gap-1.5 font-mono text-[11px]"
                :class="composerStore.triggerCheckVerdict.ok ? 'text-success' : 'text-warning'"
              >
                <CheckCircle2 v-if="composerStore.triggerCheckVerdict.ok" class="h-3 w-3" />
                <AlertTriangle v-else class="h-3 w-3" />
                <span class="truncate">
                  {{ composerStore.triggerCheckVerdict.tokens }} token(s):
                  {{ composerStore.triggerCheckVerdict.text }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Card 2: Curated Recipe Summary (Compact) -->
        <section class="rounded-xl border border-hairline bg-base-300/80 p-3 space-y-2">
          <div class="flex items-center justify-between gap-3 border-b border-hairline pb-1.5">
            <div class="flex items-center gap-2 min-w-0">
              <Sparkles class="h-3.5 w-3.5 text-secondary shrink-0" />
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-bold text-base-content truncate">
                  Recipe: <span class="text-primary">{{ parsedRecipe.title }}</span>
                </span>
                <span
                  v-if="parsedRecipe.subtitle"
                  class="text-[11px] text-subtle truncate hidden sm:inline"
                >
                  ({{ parsedRecipe.subtitle }})
                </span>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-xs btn-outline border-hairline text-[11px] h-6 min-h-0 px-2 shrink-0 cursor-pointer"
              @click="emit('switch-to-expert')"
            >
              Customize ↗
            </button>
          </div>

          <!-- Compact Parameter Badges in 1 row -->
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-lg border border-hairline bg-base-200/60 px-2.5 py-1.5">
              <span class="text-[10px] text-muted block">Network Rank</span>
              <span class="font-mono text-xs font-bold text-base-content">
                Dim {{ composerStore.draftValues.NETWORK_DIM ?? 16 }} / Alpha
                {{ composerStore.draftValues.NETWORK_ALPHA ?? 16 }}
              </span>
            </div>

            <div class="rounded-lg border border-hairline bg-base-200/60 px-2.5 py-1.5">
              <span class="text-[10px] text-muted block">Optimizer</span>
              <span class="font-mono text-xs font-bold text-primary uppercase">
                {{ composerStore.draftValues.OPTIMIZER_TYPE || "Muon" }}
              </span>
            </div>

            <div class="rounded-lg border border-hairline bg-base-200/60 px-2.5 py-1.5">
              <span class="text-[10px] text-muted block">Learning Rate</span>
              <span class="font-mono text-xs font-bold text-warning">
                {{
                  composerStore.draftValues.ADAPTIVE_LR
                    ? "Adaptive"
                    : composerStore.draftValues.LEARNING_RATE || "1e-4"
                }}
              </span>
            </div>

            <div class="rounded-lg border border-hairline bg-base-200/60 px-2.5 py-1.5">
              <span class="text-[10px] text-muted block">Resolution</span>
              <span class="font-mono text-xs font-bold text-base-content">
                {{ composerStore.draftValues.DATASET_MEGAPIXELS || "1.0" }} MP
              </span>
            </div>
          </div>
        </section>

        <!-- Card 3: Training Schedule (Compact) -->
        <section class="rounded-xl border border-hairline bg-base-300/80 p-3 space-y-2">
          <div class="flex items-center justify-between border-b border-hairline pb-1.5">
            <div class="flex items-center gap-2">
              <Clock class="h-3.5 w-3.5 text-warning" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-base-content">
                Training Schedule
              </h2>
            </div>
            <span class="font-mono text-[11px] text-muted">
              Saves every {{ composerStore.draftValues.SAVE_EVERY_N_EPOCHS ?? 1 }} epoch(s)
            </span>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-subtle"> Total Epochs: </label>
              <div class="flex items-center gap-1.5">
                <button
                  v-for="ep in [15, 30, 50, 75]"
                  :key="ep"
                  type="button"
                  class="btn btn-xs h-6 min-h-0 px-2 text-[11px]"
                  :class="
                    Number(composerStore.draftValues.MAX_TRAIN_EPOCHS) === ep
                      ? 'btn-primary'
                      : 'btn-ghost border border-hairline'
                  "
                  @click="emit('set-quick-epochs', ep)"
                >
                  {{ ep }}
                </button>
                <input
                  :value="Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30)"
                  type="number"
                  min="1"
                  max="300"
                  class="input input-xs w-14 border-hairline-strong bg-base-100 font-mono text-center font-bold text-base-content h-6"
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
          </div>
        </section>
      </div>

      <!-- RIGHT COLUMN (5 cols): Preview Prompts & Compute Preflight Telemetry -->
      <div class="flex flex-col gap-2.5 lg:col-span-5">
        <!-- Card 4: Validation Preview Prompts -->
        <section class="rounded-xl border border-hairline bg-base-300/80 p-2.5 space-y-1.5">
          <div class="flex items-center justify-between border-b border-hairline pb-1.5">
            <div class="flex items-center gap-2">
              <Eye class="h-4 w-4 text-info" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-base-content">
                Sample Prompts (Draft)
              </h2>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="samplePromptCount > 0" class="badge badge-xs badge-primary font-mono">
                {{ samplePromptCount }} prompt(s)
              </span>
              <span class="badge badge-xs badge-info font-mono">Isolated</span>
            </div>
          </div>

          <p class="text-[11px] text-subtle">
            Test prompts rendered every
            {{ composerStore.draftValues.SAMPLE_EVERY_N_EPOCHS ?? 1 }} epoch to monitor
            generalization:
          </p>

          <!-- Compact, comfortable textarea that fits nicely without page scroll -->
          <textarea
            :value="String(composerStore.draftValues.SAMPLE_PROMPT ?? '')"
            rows="5"
            placeholder="A close-up portrait of trigger, looking at camera, neutral background...&#10;&#10;A dynamic wide shot of trigger outdoors in the city, golden hour lighting..."
            class="textarea textarea-bordered w-full h-32 min-h-[90px] max-h-[220px] resize-y border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed text-base-content focus:border-primary p-2"
            @input="
              composerStore.setFieldValue(
                'SAMPLE_PROMPT',
                ($event.target as HTMLTextAreaElement).value,
              )
            "
          />

          <div class="flex items-center justify-between text-[11px] text-muted pt-0.5">
            <span>Separate multiple prompts with a blank line.</span>
            <span class="font-mono">Renders per checkpoint</span>
          </div>
        </section>

        <!-- Card 5: Sleek Compute & Preflight Readiness Strip (No redundant action buttons) -->
        <section
          class="rounded-xl border p-2.5 space-y-1.5 transition-colors"
          :class="
            isSelectedDatasetReady
              ? 'border-primary/30 bg-primary/5'
              : 'border-warning/30 bg-warning/5'
          "
        >
          <div class="flex items-center justify-between border-b border-hairline/60 pb-1.5">
            <div class="flex items-center gap-2">
              <ShieldCheck v-if="isSelectedDatasetReady" class="h-4 w-4 text-primary" />
              <ShieldAlert v-else class="h-4 w-4 text-warning" />
              <h3 class="text-xs font-bold uppercase tracking-wider text-base-content">
                Compute &amp; Readiness
              </h3>
            </div>
            <span
              class="badge badge-sm font-semibold text-[11px]"
              :class="isSelectedDatasetReady ? 'badge-success' : 'badge-warning'"
            >
              {{ isSelectedDatasetReady ? "Ready to Train" : "Incomplete Dataset" }}
            </span>
          </div>

          <!-- Compact Telemetry Row -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="flex items-center gap-1.5 rounded bg-base-300/70 px-2.5 py-1.5">
              <Cpu class="h-3.5 w-3.5 text-primary shrink-0" />
              <span class="font-mono font-medium text-base-content truncate text-[11px]">
                {{ runStore.stats?.device_name || "NVIDIA RTX 4080" }}
              </span>
            </div>

            <div class="flex items-center justify-between rounded bg-base-300/70 px-2.5 py-1.5">
              <span class="text-[11px] text-muted">Est. VRAM:</span>
              <span class="font-mono font-semibold text-success text-[11px]">
                ~11.8 / 16.0 GB
              </span>
            </div>
          </div>

          <!-- Explanatory note pointing to top launch buttons -->
          <div
            v-if="isSelectedDatasetReady"
            class="flex items-center justify-between text-[11px] text-muted pt-0.5"
          >
            <span>Launch training or queue the job from the header bar above.</span>
            <span class="font-mono text-primary font-medium">Ready ↑</span>
          </div>
          <div v-else class="flex items-center gap-1.5 text-[11px] text-warning pt-0.5">
            <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
            <span>Training locked: dataset must be 100% tagged before launch.</span>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
