<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  RefreshCw,
  Replace,
  Save,
  Scissors,
  Search,
  Sparkles,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CaptionEntry, type DatasetSummary } from "@shared/types";
import { apiGet, apiPost, thumbUrl } from "@/api/client";
import { useSchemaStore } from "@/stores/schema";
import { useComposerStore } from "@/stores/composer";

const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();

const activeSubTab = ref<"captions" | "prep">("captions");
const selectedFolder = ref<string>("");
const loadingCaptions = ref(false);
const entries = ref<CaptionEntry[]>([]);
const editedCaptions = ref<Record<string, string>>({});
const dirtyPaths = ref<Set<string>>(new Set());
const searchQuery = ref("");
const filterMode = ref<"all" | "uncaptioned" | "dirty">("all");

// Trigger word tokenizer check
const triggerWord = ref("");
const triggerResult = ref<Record<string, unknown> | null>(null);
const checkingTrigger = ref(false);

// Bulk Find & Replace
const findText = ref("");
const replaceText = ref("");
const dryRunPreview = ref<{ changed?: number; note?: string } | null>(null);

// Image Prep state
const prepInputFolder = ref("");
const prepOutputFolder = ref("");
const prepSummary = ref<Record<string, unknown> | null>(null);
const loadingPrep = ref(false);

const selectedDataset = computed<DatasetSummary | undefined>(() =>
  schemaStore.datasets.find((d) => d.path === selectedFolder.value),
);

const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return entries.value.filter((item) => {
    const currentCaption = editedCaptions.value[item.path] ?? item.caption ?? "";
    if (filterMode.value === "uncaptioned" && currentCaption.trim().length > 0) {
      return false;
    }
    if (filterMode.value === "dirty" && !dirtyPaths.value.has(item.path)) {
      return false;
    }
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || currentCaption.toLowerCase().includes(q);
  });
});

async function loadDatasetCaptions(folderPath: string): Promise<void> {
  if (!folderPath) return;
  loadingCaptions.value = true;
  try {
    const res = await apiGet<{
      items?: CaptionEntry[];
      images?: CaptionEntry[];
    }>("/api/captions", { folder: folderPath });
    const list = res.items ?? res.images ?? [];
    entries.value = list;
    const map: Record<string, string> = {};
    for (const item of list) {
      map[item.path] = item.caption ?? "";
    }
    editedCaptions.value = map;
    dirtyPaths.value = new Set();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to load dataset captions");
  } finally {
    loadingCaptions.value = false;
  }
}

function onCaptionChange(path: string, value: string, original: string): void {
  editedCaptions.value[path] = value;
  const next = new Set(dirtyPaths.value);
  if (value !== (original ?? "")) {
    next.add(path);
  } else {
    next.delete(path);
  }
  dirtyPaths.value = next;
}

async function saveCaption(item: CaptionEntry): Promise<void> {
  const caption = editedCaptions.value[item.path] ?? "";
  try {
    await apiPost("/api/captions/save", {
      folder: selectedFolder.value,
      path: item.path,
      name: item.name,
      caption,
    });
    item.caption = caption;
    const next = new Set(dirtyPaths.value);
    next.delete(item.path);
    dirtyPaths.value = next;
    toast.success(`Saved ${item.name}`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to save caption");
  }
}

async function saveAllDirty(): Promise<void> {
  const paths = Array.from(dirtyPaths.value);
  if (!paths.length) return;
  let saved = 0;
  for (const path of paths) {
    const item = entries.value.find((e) => e.path === path);
    if (item) {
      await saveCaption(item);
      saved++;
    }
  }
  toast.success(`Saved ${saved} captions`);
}

async function checkTriggerTokens(): Promise<void> {
  if (!triggerWord.value.trim()) return;
  checkingTrigger.value = true;
  try {
    triggerResult.value = await apiPost<Record<string, unknown>>("/api/captions/trigger_check", {
      word: triggerWord.value.trim(),
      trigger: triggerWord.value.trim(),
      family: composerStore.family,
      folder: selectedFolder.value,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Trigger check failed");
  } finally {
    checkingTrigger.value = false;
  }
}

async function runFindReplace(dryRun: boolean): Promise<void> {
  if (!selectedFolder.value || !findText.value) return;
  try {
    const res = await apiPost<{ changed?: number; note?: string }>("/api/captions/replace", {
      folder: selectedFolder.value,
      find: findText.value,
      replace: replaceText.value,
      dry_run: dryRun,
    });
    dryRunPreview.value = res;
    if (!dryRun) {
      toast.success(res.note ?? `Updated ${res.changed ?? 0} captions`);
      await loadDatasetCaptions(selectedFolder.value);
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Find/replace failed");
  }
}

async function inspectPrepFolder(): Promise<void> {
  const folder = prepInputFolder.value || selectedFolder.value;
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

function sendToComposer(folderPath: string): void {
  composerStore.imageFolder = folderPath;
  toast.success(`Selected ${folderPath} in Run Composer`);
  void router.push("/composer");
}

watch(selectedFolder, (folder) => {
  if (folder) {
    prepInputFolder.value = folder;
    void loadDatasetCaptions(folder);
  }
});

onMounted(async () => {
  await schemaStore.fetchDatasets();
  if (!selectedFolder.value && schemaStore.datasets.length > 0) {
    selectedFolder.value = schemaStore.datasets[0]!.path;
  }
});
</script>

<template>
  <div class="grid h-[calc(100vh-44px)] grid-cols-[280px_1fr] overflow-hidden bg-base-100">
    <!-- Left Sidebar: Dataset Browser -->
    <aside class="flex flex-col border-r border-base-300 bg-base-200/50 overflow-hidden">
      <div class="flex items-center justify-between border-b border-base-300 px-3.5 py-2.5">
        <div class="flex items-center gap-2">
          <FolderOpen class="h-4 w-4 text-primary" />
          <h2 class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
            Datasets ({{ schemaStore.datasets.length }})
          </h2>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-base-content/60"
          title="Refresh datasets"
          @click="schemaStore.fetchDatasets()"
        >
          <RefreshCw class="h-3.5 w-3.5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div
          v-for="ds in schemaStore.datasets"
          :key="ds.path"
          class="group rounded border p-2.5 transition-colors cursor-pointer"
          :class="
            selectedFolder === ds.path
              ? 'border-primary/50 bg-primary/10'
              : 'border-base-300/60 bg-base-200/60 hover:border-base-300 hover:bg-base-200'
          "
          @click="selectedFolder = ds.path"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-xs font-semibold text-base-content">
              {{ ds.name }}
            </span>
            <span class="badge badge-xs border-base-300 bg-base-300/70 font-mono text-[10px]">
              {{ ds.count }} img
            </span>
          </div>
          <div class="mt-1 truncate font-mono text-[11px] text-base-content/45">
            {{ ds.path }}
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span
              v-if="ds.captioned !== undefined"
              class="text-[10px] font-mono"
              :class="ds.captioned >= ds.count ? 'text-success' : 'text-warning'"
            >
              {{ ds.captioned }}/{{ ds.count }} captioned
            </span>
            <button
              type="button"
              class="btn btn-xs btn-ghost h-5 min-h-0 px-1.5 text-[10px] text-primary opacity-80 hover:opacity-100"
              @click.stop="sendToComposer(ds.path)"
            >
              Use in Run
              <ArrowRight class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Workspace: Caption Studio & Image Prep -->
    <main class="flex flex-col overflow-hidden">
      <!-- Top Bar -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-200/40 px-4 py-2.5"
      >
        <div class="flex items-center gap-3">
          <div class="join">
            <button
              type="button"
              class="btn btn-xs join-item"
              :class="activeSubTab === 'captions' ? 'btn-primary' : 'btn-ghost'"
              @click="activeSubTab = 'captions'"
            >
              Caption Studio
            </button>
            <button
              type="button"
              class="btn btn-xs join-item"
              :class="activeSubTab === 'prep' ? 'btn-primary' : 'btn-ghost'"
              @click="activeSubTab = 'prep'"
            >
              <Scissors class="h-3.5 w-3.5" />
              Image Prep & Bucketing
            </button>
          </div>

          <span v-if="selectedDataset" class="font-mono text-xs text-base-content/60">
            {{ selectedDataset.path }}
          </span>
        </div>

        <div v-if="activeSubTab === 'captions'" class="flex items-center gap-2">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-base-content/40"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter filename or caption..."
              class="input input-xs input-bordered bg-base-300/60 pl-8 w-56 text-xs"
            />
          </div>

          <div class="join">
            <button
              type="button"
              class="btn btn-xs join-item"
              :class="filterMode === 'all' ? 'btn-neutral' : 'btn-ghost'"
              @click="filterMode = 'all'"
            >
              All ({{ entries.length }})
            </button>
            <button
              type="button"
              class="btn btn-xs join-item"
              :class="filterMode === 'uncaptioned' ? 'btn-neutral' : 'btn-ghost'"
              @click="filterMode = 'uncaptioned'"
            >
              Uncaptioned
            </button>
            <button
              type="button"
              class="btn btn-xs join-item"
              :class="filterMode === 'dirty' ? 'btn-warning' : 'btn-ghost'"
              @click="filterMode = 'dirty'"
            >
              Unsaved ({{ dirtyPaths.size }})
            </button>
          </div>

          <button
            v-if="dirtyPaths.size > 0"
            type="button"
            class="btn btn-xs btn-primary"
            @click="saveAllDirty"
          >
            <Save class="h-3.5 w-3.5" />
            Save All ({{ dirtyPaths.size }})
          </button>
        </div>
      </div>

      <!-- Sub-tab 1: Caption Studio -->
      <div v-if="activeSubTab === 'captions'" class="flex flex-1 flex-col overflow-hidden">
        <!-- Tokenizer Check & Find/Replace Utility Strip -->
        <div
          class="grid grid-cols-1 gap-3 border-b border-base-300 bg-base-200/25 px-4 py-2.5 xl:grid-cols-2"
        >
          <!-- Trigger Tokenizer Inspector -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
              Trigger Token Check:
            </span>
            <input
              v-model="triggerWord"
              type="text"
              placeholder="e.g. jeje, ohwx"
              class="input input-xs input-bordered bg-base-300/60 font-mono text-xs w-36"
              @keyup.enter="checkTriggerTokens"
            />
            <button
              type="button"
              class="btn btn-xs btn-outline border-base-300"
              :disabled="checkingTrigger"
              @click="checkTriggerTokens"
            >
              <Sparkles class="h-3 w-3 text-primary" />
              Inspect Tokens
            </button>
            <span v-if="triggerResult" class="truncate font-mono text-[11px] text-info">
              {{ triggerResult.note || triggerResult.summary || JSON.stringify(triggerResult) }}
            </span>
          </div>

          <!-- Bulk Find & Replace -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
              Bulk Replace:
            </span>
            <input
              v-model="findText"
              type="text"
              placeholder="Find text..."
              class="input input-xs input-bordered bg-base-300/60 text-xs w-32"
            />
            <input
              v-model="replaceText"
              type="text"
              placeholder="Replace with..."
              class="input input-xs input-bordered bg-base-300/60 text-xs w-32"
            />
            <button
              type="button"
              class="btn btn-xs btn-ghost border border-base-300"
              @click="runFindReplace(true)"
            >
              Dry Run
            </button>
            <button type="button" class="btn btn-xs btn-secondary" @click="runFindReplace(false)">
              <Replace class="h-3 w-3" />
              Apply
            </button>
            <span v-if="dryRunPreview" class="font-mono text-[11px] text-warning">
              {{ dryRunPreview.note || `${dryRunPreview.changed ?? 0} matches` }}
            </span>
          </div>
        </div>

        <!-- Caption Cards Grid -->
        <div class="flex-1 overflow-y-auto p-4">
          <div
            v-if="loadingCaptions"
            class="flex h-48 items-center justify-center text-xs text-base-content/50"
          >
            Loading dataset images and captions...
          </div>

          <div
            v-else-if="filteredEntries.length === 0"
            class="flex h-48 flex-col items-center justify-center gap-2 text-xs text-base-content/50"
          >
            <AlertTriangle class="h-5 w-5 text-warning" />
            <span>No matching images in this dataset filter.</span>
          </div>

          <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            <div
              v-for="item in filteredEntries"
              :key="item.path"
              class="flex gap-3 rounded-lg border bg-base-200/70 p-2.5 transition-colors"
              :class="dirtyPaths.has(item.path) ? 'border-warning/60' : 'border-base-300'"
            >
              <div
                class="relative h-28 w-28 shrink-0 overflow-hidden rounded border border-base-300 bg-base-300"
              >
                <img
                  :src="thumbUrl(item.path, 256)"
                  :alt="item.name"
                  loading="lazy"
                  class="h-full w-full object-cover"
                />
                <span
                  v-if="item.width && item.height"
                  class="absolute bottom-1 right-1 rounded bg-base-100/85 px-1 py-0.5 font-mono text-[9px] text-base-content/75"
                >
                  {{ item.width }}×{{ item.height }}
                </span>
              </div>

              <div class="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-mono text-[11px] font-medium text-base-content/85">
                    {{ item.name }}
                  </span>
                  <div class="flex items-center gap-1">
                    <span
                      v-if="dirtyPaths.has(item.path)"
                      class="badge badge-warning badge-xs text-[9px]"
                    >
                      modified
                    </span>
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost h-6 min-h-0 px-1.5 text-primary"
                      :disabled="!dirtyPaths.has(item.path)"
                      title="Save caption"
                      @click="saveCaption(item)"
                    >
                      <Save class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  :value="editedCaptions[item.path] ?? item.caption ?? ''"
                  rows="3"
                  placeholder="Enter training caption..."
                  class="textarea textarea-bordered w-full flex-1 bg-base-300/60 p-2 text-xs leading-snug focus:border-primary"
                  @input="
                    onCaptionChange(
                      item.path,
                      ($event.target as HTMLTextAreaElement).value,
                      item.caption,
                    )
                  "
                  @keydown.ctrl.s.prevent="saveCaption(item)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-tab 2: Image Prep & Bucketing Inspector -->
      <div v-else class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-3xl space-y-4">
          <div class="rounded-lg border border-base-300 bg-base-200 p-4 space-y-3">
            <h3 class="text-sm font-semibold text-base-content">
              Dataset Aspect-Ratio & Prep Inspector
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
                <input
                  v-model="prepInputFolder"
                  type="text"
                  class="input input-sm input-bordered w-full bg-base-300/70 font-mono text-xs"
                />
              </div>
              <div>
                <label class="label py-1 text-xs font-medium text-base-content/75">
                  Prepared Output Folder (Optional)
                </label>
                <input
                  v-model="prepOutputFolder"
                  type="text"
                  placeholder="/datasets/my_dataset_prepped"
                  class="input input-sm input-bordered w-full bg-base-300/70 font-mono text-xs"
                />
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button
                type="button"
                class="btn btn-sm btn-primary"
                :disabled="loadingPrep"
                @click="inspectPrepFolder"
              >
                <CheckCircle2 class="h-4 w-4" />
                Inspect Folder Summary
              </button>
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
    </main>
  </div>
</template>
