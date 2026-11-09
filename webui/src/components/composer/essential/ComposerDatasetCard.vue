<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Folder,
  FolderCheck,
  FolderOpen,
  Search,
  Sparkles,
  Wand2,
} from "lucide-vue-next";
import { type DatasetSummary } from "@shared/types";
import { useComposerStore } from "@/stores/composer";
import { useSchemaStore } from "@/stores/schema";

defineProps<{
  selectedDatasetInfo: DatasetSummary | null;
  isSelectedDatasetReady: boolean;
}>();

const emit = defineEmits<{
  (e: "select-dataset", path: string): void;
  (e: "auto-name"): void;
}>();

const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();

const datasetFilter = ref("");

function isDatasetCompletelyTagged(ds: DatasetSummary | null | undefined): boolean {
  if (!ds) return false;
  const count = ds.count ?? ds.pictures ?? 0;
  if (count <= 0) return false;
  const captioned = ds.captioned ?? 0;
  return captioned >= count;
}

const filteredDatasets = computed(() => {
  const query = datasetFilter.value.trim().toLowerCase();
  if (!query) return schemaStore.datasets;
  return schemaStore.datasets.filter(
    (d) => d.name.toLowerCase().includes(query) || d.path.toLowerCase().includes(query),
  );
});

function onSelectDataset(path: string): void {
  composerStore.setImageFolder(path);
  emit("select-dataset", path);
}
</script>

<template>
  <section
    class="rounded-xl border border-hairline bg-base-300/80 p-2.5 space-y-1.5 h-145.5 flex flex-col justify-between"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-hairline pb-1.5 shrink-0">
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

    <!-- Dataset Picker: Scrollable List with Search -->
    <div class="space-y-1 flex-1 min-h-0 flex flex-col">
      <div class="flex items-center justify-between shrink-0">
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

      <!-- Scrollable list: flex-1 up to 425px showing full 8 rows cleanly -->
      <div
        class="flex-1 min-h-90 max-h-106.25 overflow-y-auto rounded-lg border border-hairline bg-base-200/50 p-1 scrollbar-thin flex flex-col"
      >
        <!-- Centered Empty State in Both Directions -->
        <div
          v-if="filteredDatasets.length === 0"
          class="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center select-none"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline bg-base-300/80 text-muted/60 shadow-xs"
          >
            <FolderOpen class="h-6 w-6 text-muted/60" />
          </div>
          <div class="space-y-1">
            <h3 class="text-xs font-bold uppercase tracking-wider text-base-content/80">
              No Dataset Found
            </h3>
            <p v-if="datasetFilter" class="text-[11px] text-muted">
              No datasets matching &ldquo;{{ datasetFilter }}&rdquo;
            </p>
            <p v-else class="text-[11px] text-muted max-w-56 leading-relaxed">
              Place training image folders in your datasets root or use Image Prep &amp; Bucketing.
            </p>
          </div>
        </div>

        <div v-else class="space-y-1">
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
                <span class="font-mono text-[10px] text-muted truncate block max-w-xs sm:max-w-sm">
                  {{ ds.path }}
                </span>
              </div>
            </div>

            <!-- Right: Uniform Badges -->
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
      </div>

      <!-- Incomplete Dataset Warning Callout -->
      <div
        v-if="selectedDatasetInfo && !isSelectedDatasetReady"
        class="flex items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs text-warning shrink-0"
      >
        <div class="flex items-center gap-1.5 truncate">
          <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">
            Incomplete captions:
            <strong
              >{{ selectedDatasetInfo.captioned ?? 0 }}/{{ selectedDatasetInfo.count }}</strong
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
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-0.5 shrink-0">
      <div>
        <div class="mb-0.5 flex items-center justify-between">
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
          class="input input-sm h-8.5 w-full rounded-lg border-hairline-strong bg-base-100 font-mono text-xs text-base-content focus:border-primary focus:outline-none"
          @input="
            composerStore.setFieldValue('LORA_NAME', ($event.target as HTMLInputElement).value)
          "
        />
      </div>

      <div>
        <div class="mb-0.5 flex items-center justify-between">
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
          class="input input-sm h-8.5 w-full rounded-lg border-hairline-strong bg-base-100 font-mono text-xs text-base-content focus:border-primary focus:outline-none"
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
          class="mt-0.5 flex items-center gap-1.5 font-mono text-[11px]"
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
</template>
