<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Folder,
  FolderCheck,
  FolderOpen,
  ListPlus,
  Play,
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
  (e: "start-run"): void;
  (e: "queue-run"): void;
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
</script>

<template>
  <main class="flex-1 overflow-y-auto p-5">
    <div class="mx-auto max-w-6xl grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- LEFT COLUMN (7 cols): Data, Recipe Summary, and Schedule -->
      <div class="flex flex-col gap-5 lg:col-span-7">
        <!-- Card 1: Dataset & Output Identity -->
        <section class="rounded-xl border border-hairline bg-base-300/80 p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-hairline pb-3">
            <div class="flex items-center gap-2">
              <FolderOpen class="h-4 w-4 text-primary" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
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
          <div class="space-y-2">
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

            <!-- Scrollable list of dataset folders -->
            <div
              class="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-hairline bg-base-200/50 p-1.5 scrollbar-thin"
            >
              <div v-if="filteredDatasets.length === 0" class="py-6 text-center text-xs text-muted">
                No datasets matching "{{ datasetFilter }}"
              </div>
              <button
                v-for="ds in filteredDatasets"
                :key="ds.path"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-md border p-2 text-left transition cursor-pointer"
                :class="
                  composerStore.imageFolder === ds.path
                    ? 'border-primary bg-primary/15 text-base-content shadow-sm'
                    : 'border-hairline bg-base-100/70 text-base-content hover:border-hairline-strong hover:bg-base-100'
                "
                @click="emit('select-dataset', ds.path)"
              >
                <!-- Left: Icon & Names -->
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded shrink-0"
                    :class="
                      isDatasetCompletelyTagged(ds)
                        ? 'bg-success/15 text-success'
                        : 'bg-warning/15 text-warning'
                    "
                  >
                    <FolderCheck v-if="isDatasetCompletelyTagged(ds)" class="h-4 w-4" />
                    <Folder v-else class="h-4 w-4" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-xs truncate">{{ ds.name }}</span>
                      <span
                        v-if="composerStore.imageFolder === ds.path"
                        class="badge badge-xs badge-primary font-mono"
                      >
                        Selected
                      </span>
                    </div>
                    <span
                      class="font-mono text-[10px] text-muted truncate block max-w-xs sm:max-w-md"
                    >
                      {{ ds.path }}
                    </span>
                  </div>
                </div>

                <!-- Right: Status Badges -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <span
                    v-if="isDatasetCompletelyTagged(ds)"
                    class="badge badge-sm badge-success font-mono text-[11px] gap-1"
                  >
                    <CheckCircle2 class="h-3 w-3" />
                    {{ ds.count }} imgs · 100% tagged
                  </span>
                  <div v-else class="flex items-center gap-1">
                    <span class="badge badge-sm badge-warning font-mono text-[11px] gap-1">
                      <AlertTriangle class="h-3 w-3" />
                      {{ ds.captioned ?? 0 }}/{{ ds.count }} tagged
                    </span>
                    <span
                      class="badge badge-xs border border-warning/40 bg-warning/10 text-warning text-[10px]"
                    >
                      Incomplete
                    </span>
                  </div>
                </div>
              </button>
            </div>

            <!-- Selected Dataset Status Callout -->
            <div
              v-if="selectedDatasetInfo && isSelectedDatasetReady"
              class="flex items-center justify-between rounded-md border border-success/30 bg-success/10 px-3 py-1.5 text-xs text-success"
            >
              <div class="flex items-center gap-1.5 truncate">
                <CheckCircle2 class="h-4 w-4 shrink-0" />
                <span class="truncate">
                  Dataset ready for training: <strong>{{ selectedDatasetInfo.name }}</strong> ({{
                    selectedDatasetInfo.count
                  }}
                  pictures fully tagged).
                </span>
              </div>
            </div>
            <div
              v-else-if="selectedDatasetInfo && !isSelectedDatasetReady"
              class="flex items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning"
            >
              <div class="flex items-center gap-2 min-w-0">
                <AlertTriangle class="h-4 w-4 shrink-0" />
                <div class="min-w-0">
                  <div class="font-semibold">Dataset Incompletely Tagged</div>
                  <div class="text-[11px] text-warning/90">
                    Only {{ selectedDatasetInfo.captioned ?? 0 }} of
                    {{ selectedDatasetInfo.count }} images have captions. Training requires 100%
                    tagged images.
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-xs btn-warning btn-outline gap-1 text-[11px] shrink-0 cursor-pointer"
                @click="router.push('/datasets')"
              >
                <span>Complete Tagging</span>
                <ArrowRight class="h-3 w-3" />
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
          <div class="flex items-start justify-between gap-3 border-b border-hairline pb-3">
            <div class="flex items-start gap-2.5 min-w-0">
              <Sparkles class="h-4 w-4 text-secondary mt-0.5 shrink-0" />
              <div class="flex flex-col gap-0.5 min-w-0">
                <h2 class="text-sm font-bold tracking-wider text-base-content">
                  Active Recipe:
                  <span class="text-primary font-bold">{{ parsedRecipe.title }}</span>
                </h2>
                <p v-if="parsedRecipe.subtitle" class="text-xs text-subtle font-normal">
                  {{ parsedRecipe.subtitle }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-xs btn-outline border-hairline text-xs shrink-0 cursor-pointer"
              @click="emit('switch-to-expert')"
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
                  @click="emit('set-quick-epochs', ep)"
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
            <div class="flex items-center gap-2">
              <span v-if="samplePromptCount > 0" class="badge badge-xs badge-primary font-mono">
                {{ samplePromptCount }} prompt(s)
              </span>
              <span class="badge badge-xs badge-info font-mono">Isolated from live run</span>
            </div>
          </div>

          <p class="text-xs text-subtle">
            Test prompts generated at each checkpoint to evaluate likeness and generalization:
          </p>

          <!-- Significantly enlarged sample prompt textarea -->
          <textarea
            :value="String(composerStore.draftValues.SAMPLE_PROMPT ?? '')"
            rows="12"
            placeholder="A close-up portrait of trigger, looking at camera, neutral background...&#10;&#10;A dynamic wide shot of trigger outdoors in the city, golden hour lighting..."
            class="textarea textarea-bordered w-full min-h-[260px] resize-y border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed text-base-content focus:border-primary p-3"
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
              >Renders every {{ composerStore.draftValues.SAMPLE_EVERY_N_EPOCHS ?? 1 }} epoch</span
            >
          </div>
        </section>

        <!-- Card 5: Preflight Check & Launch Station -->
        <section
          class="rounded-xl border p-5 space-y-4 transition-colors"
          :class="
            isSelectedDatasetReady
              ? 'border-primary/30 bg-primary/5'
              : 'border-warning/30 bg-warning/5'
          "
        >
          <div class="flex items-center justify-between border-b border-hairline pb-3">
            <div class="flex items-center gap-2">
              <ShieldCheck v-if="isSelectedDatasetReady" class="h-4 w-4 text-primary" />
              <ShieldAlert v-else class="h-4 w-4 text-warning" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                Preflight &amp; Launch Station
              </h2>
            </div>
            <span
              class="badge badge-sm font-semibold"
              :class="isSelectedDatasetReady ? 'badge-success' : 'badge-warning'"
            >
              {{ isSelectedDatasetReady ? "Ready" : "Incomplete Dataset" }}
            </span>
          </div>

          <!-- Health Checklist -->
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between rounded bg-base-300/60 px-3 py-2">
              <span class="text-subtle">Selected Dataset:</span>
              <div class="flex items-center gap-1.5 max-w-[240px]">
                <span class="font-mono font-semibold text-base-content truncate">
                  {{ selectedDatasetInfo?.name || composerStore.imageFolder || "None selected" }}
                </span>
                <span
                  v-if="selectedDatasetInfo"
                  class="badge badge-xs font-mono shrink-0"
                  :class="isSelectedDatasetReady ? 'badge-success' : 'badge-warning'"
                >
                  {{ selectedDatasetInfo.captioned ?? 0 }}/{{ selectedDatasetInfo.count }}
                </span>
              </div>
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

          <!-- Warning notice if dataset is not ready -->
          <div
            v-if="!isSelectedDatasetReady"
            class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning space-y-1.5"
          >
            <div class="flex items-center gap-1.5 font-semibold">
              <AlertTriangle class="h-4 w-4 shrink-0" />
              <span>Training Blocked: Incomplete Captions</span>
            </div>
            <p class="text-[11px] text-warning/90 leading-relaxed">
              You can only process training on a dataset that is completely tagged. Head to the
              Datasets tab to finish captioning remaining images.
            </p>
          </div>

          <!-- Main Launch Actions -->
          <div class="space-y-2 pt-2">
            <button
              type="button"
              class="btn btn-primary w-full gap-2 font-bold text-sm shadow-lg cursor-pointer"
              :disabled="!isSelectedDatasetReady || !canProcess || runStore.isActiveOrStarting"
              :title="
                !isSelectedDatasetReady
                  ? 'Only completely tagged datasets can be trained'
                  : runStore.isActiveOrStarting
                    ? 'A training run is currently active on the GPU — use Add to Queue instead'
                    : 'Validate and start training now'
              "
              @click="emit('start-run')"
            >
              <Play class="h-4 w-4 fill-current" />
              Start Training Run Now
            </button>

            <button
              type="button"
              class="btn btn-ghost border border-hairline-strong w-full gap-2 text-xs cursor-pointer"
              :disabled="!isSelectedDatasetReady || !canProcess"
              :title="
                !isSelectedDatasetReady
                  ? 'Only completely tagged datasets can be queued'
                  : 'Submit this job to the background training queue'
              "
              @click="emit('queue-run')"
            >
              <ListPlus class="h-4 w-4" />
              Add to Background Training Queue
            </button>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
