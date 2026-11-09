<script setup lang="ts">
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FolderOpen,
  ListPlus,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";

defineProps<{
  selectedDatasetInfo: DatasetSummary | null;
  parsedRecipe: { title: string; subtitle: string };
  currentPresetNote: string | null;
}>();

const emit = defineEmits<{
  (e: "start-run"): void;
  (e: "queue-run"): void;
  (e: "switch-to-expert"): void;
  (e: "select-dataset", path: string): void;
  (e: "auto-name"): void;
  (e: "set-quick-epochs", epochs: number): void;
}>();

const schemaStore = useSchemaStore();
const composerStore = useComposerStore();
const runStore = useRunStore();
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
                class="flex flex-col items-start rounded-lg border p-2.5 text-left transition cursor-pointer"
                :class="
                  composerStore.imageFolder === ds.path
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-hairline bg-base-200/70 text-base-content hover:border-hairline-strong'
                "
                @click="emit('select-dataset', ds.path)"
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
              >Renders every {{ composerStore.draftValues.SAMPLE_EVERY_N_EPOCHS ?? 1 }} epoch</span
            >
          </div>
        </section>

        <!-- Card 5: Preflight Check & Launch Station -->
        <section class="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-hairline pb-3">
            <div class="flex items-center gap-2">
              <ShieldCheck class="h-4 w-4 text-primary" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-base-content">
                Preflight &amp; Launch Station
              </h2>
            </div>
            <span class="badge badge-sm badge-success font-semibold">Ready</span>
          </div>

          <!-- Health Checklist -->
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between rounded bg-base-300/60 px-3 py-2">
              <span class="text-subtle">Selected Dataset:</span>
              <span class="font-mono font-semibold text-base-content truncate max-w-[240px]">
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
              class="btn btn-primary w-full gap-2 font-bold text-sm shadow-lg cursor-pointer"
              :disabled="runStore.isActiveOrStarting"
              @click="emit('start-run')"
            >
              <Play class="h-4 w-4 fill-current" />
              Start Training Run Now
            </button>

            <button
              type="button"
              class="btn btn-ghost border border-hairline-strong w-full gap-2 text-xs cursor-pointer"
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
