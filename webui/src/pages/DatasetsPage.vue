<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Scissors } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CaptionEntry, type DatasetSummary } from "@shared/types";
import { apiGet, apiPost } from "@/api/client";
import { parseCaptionEntriesResponse } from "@/api/schemas";
import { BasePillGroup } from "@/components/common";
import { useSchemaStore } from "@/stores/schema";
import { useComposerStore } from "@/stores/composer";
import DatasetCaptionStudio from "@/components/datasets/DatasetCaptionStudio.vue";
import DatasetImagePrep from "@/components/datasets/DatasetImagePrep.vue";
import DatasetSidebar from "@/components/datasets/DatasetSidebar.vue";

const route = useRoute();
const router = useRouter();
const schemaStore = useSchemaStore();
const composerStore = useComposerStore();

const activeSubTab = ref<"captions" | "prep">(route.query.tab === "prep" ? "prep" : "captions");

watch(
  () => route.query.tab,
  (qTab) => {
    activeSubTab.value = qTab === "prep" ? "prep" : "captions";
  },
);

watch(activeSubTab, (tab) => {
  const cur = route.query.tab === "prep" ? "prep" : "captions";
  if (cur !== tab) {
    const nextQuery = { ...route.query };
    if (tab === "captions") {
      delete nextQuery.tab;
    } else {
      nextQuery.tab = tab;
    }
    void router.replace({ query: nextQuery });
  }
});
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
    const res = await apiGet<unknown>("/api/captions", { folder: folderPath });
    const list = parseCaptionEntriesResponse(res);
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
  composerStore.selectDataset(folderPath, true);
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
  <div class="grid h-full grid-cols-[280px_1fr] overflow-hidden bg-canvas">
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
        class="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-base-200 px-4 py-2"
      >
        <div class="flex items-center gap-3">
          <BasePillGroup
            :model-value="activeSubTab"
            :options="[
              { value: 'captions', label: 'Caption Studio' },
              { value: 'prep', label: 'Image Prep & Bucketing', icon: Scissors },
            ]"
            @update:model-value="(val) => (activeSubTab = val as 'captions' | 'prep')"
          />

          <span v-if="selectedDataset" class="font-mono text-xs text-subtle">
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
