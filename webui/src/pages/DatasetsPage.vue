<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Scissors } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CaptionEntry, type DatasetSummary } from "@shared/types";
import { apiGet, apiPost } from "@/api/client";
import { useSchemaStore } from "@/stores/schema";
import { useComposerStore } from "@/stores/composer";
import DatasetCaptionStudio from "@/components/datasets/DatasetCaptionStudio.vue";
import DatasetImagePrep from "@/components/datasets/DatasetImagePrep.vue";
import DatasetSidebar from "@/components/datasets/DatasetSidebar.vue";

const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();

const activeSubTab = ref<"captions" | "prep">("captions");
const selectedFolder = ref<string>("");
const loadingCaptions = ref(false);
const entries = ref<CaptionEntry[]>([]);
const editedCaptions = ref<Record<string, string>>({});
const dirtyPaths = ref<Set<string>>(new Set());

const selectedDataset = computed<DatasetSummary | undefined>(() =>
  schemaStore.datasets.find((d) => d.path === selectedFolder.value),
);

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

function onCaptionChange(payload: { path: string; value: string; original: string }): void {
  editedCaptions.value[payload.path] = payload.value;
  const next = new Set(dirtyPaths.value);
  if (payload.value !== (payload.original ?? "")) {
    next.add(payload.path);
  } else {
    next.delete(payload.path);
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

function sendToComposer(folderPath: string): void {
  composerStore.imageFolder = folderPath;
  toast.success(`Selected ${folderPath} in Run Composer`);
  void router.push("/composer");
}

watch(selectedFolder, (folder) => {
  if (folder) {
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
    <DatasetSidebar
      :datasets="schemaStore.datasets"
      :selected-folder="selectedFolder"
      @select="(folder) => (selectedFolder = folder)"
      @send-to-composer="sendToComposer"
      @refresh="schemaStore.fetchDatasets()"
    />

    <!-- Main Workspace: Caption Studio & Image Prep -->
    <main class="flex flex-col overflow-hidden">
      <!-- Top Bar Sub-Tab Switcher -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-200/40 px-4 py-2.5"
      >
        <div class="flex items-center gap-3">
          <div class="join">
            <button
              type="button"
              class="btn btn-xs join-item cursor-pointer"
              :class="activeSubTab === 'captions' ? 'btn-primary' : 'btn-ghost'"
              @click="activeSubTab = 'captions'"
            >
              Caption Studio
            </button>
            <button
              type="button"
              class="btn btn-xs join-item cursor-pointer gap-1"
              :class="activeSubTab === 'prep' ? 'btn-primary' : 'btn-ghost'"
              @click="activeSubTab = 'prep'"
            >
              <Scissors class="h-3.5 w-3.5" />
              <span>Image Prep &amp; Bucketing</span>
            </button>
          </div>

          <span v-if="selectedDataset" class="font-mono text-xs text-base-content/60">
            {{ selectedDataset.path }}
          </span>
        </div>
      </div>

      <!-- Sub-tab 1: Caption Studio -->
      <DatasetCaptionStudio
        v-if="activeSubTab === 'captions'"
        :selected-folder="selectedFolder"
        :entries="entries"
        :edited-captions="editedCaptions"
        :dirty-paths="dirtyPaths"
        :loading="loadingCaptions"
        @caption-change="onCaptionChange"
        @save-caption="saveCaption"
        @save-all-dirty="saveAllDirty"
        @reload-captions="loadDatasetCaptions(selectedFolder)"
      />

      <!-- Sub-tab 2: Image Prep & Bucketing Inspector -->
      <DatasetImagePrep v-else :selected-folder="selectedFolder" />
    </main>
  </div>
</template>
