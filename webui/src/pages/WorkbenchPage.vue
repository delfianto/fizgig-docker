<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { type CheckpointItem } from "@shared/types";
import { apiGet } from "@/api/client";
import { useRunStore } from "@/stores/run";
import WorkbenchBlockProfiler from "@/components/workbench/WorkbenchBlockProfiler.vue";
import WorkbenchBlockStudio from "@/components/workbench/WorkbenchBlockStudio.vue";
import WorkbenchHeaderBar from "@/components/workbench/WorkbenchHeaderBar.vue";
import WorkbenchLoraRoyale from "@/components/workbench/WorkbenchLoraRoyale.vue";
import WorkbenchMetadataInspector from "@/components/workbench/WorkbenchMetadataInspector.vue";

const route = useRoute();
const router = useRouter();
const runStore = useRunStore();

type WorkbenchTool = "studio" | "royale" | "profiler" | "metadata";

function parseWorkbenchTool(raw: unknown): WorkbenchTool {
  if (raw === "royale" || raw === "profiler" || raw === "metadata") return raw;
  return "studio";
}

const activeTool = ref<WorkbenchTool>(parseWorkbenchTool(route.query.tool));
const selectedLoraPath = ref<string>("");

watch(
  () => route.query.tool,
  (qTool) => {
    activeTool.value = parseWorkbenchTool(qTool);
  },
);

watch(activeTool, (tool) => {
  const cur = parseWorkbenchTool(route.query.tool);
  if (cur !== tool) {
    const nextQuery = { ...route.query };
    if (tool === "studio") {
      delete nextQuery.tool;
    } else {
      nextQuery.tool = tool;
    }
    void router.replace({ query: nextQuery });
  }
});

// Metadata Inspector state
const metadataJson = ref<Record<string, unknown> | null>(null);
const loadingMetadata = ref(false);

// Profiler & Royale status
const profilerStatus = ref<Record<string, unknown> | null>(null);
const royaleStatus = ref<Record<string, unknown> | null>(null);

const selectedCheckpoint = computed<CheckpointItem | undefined>(() =>
  runStore.allCheckpoints.find((c) => c.path === selectedLoraPath.value),
);

async function inspectSafetensorsMetadata(): Promise<void> {
  if (!selectedLoraPath.value) return;
  loadingMetadata.value = true;
  try {
    metadataJson.value = await apiGet<Record<string, unknown>>("/api/metadata", {
      path: selectedLoraPath.value,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to read safetensors header");
  } finally {
    loadingMetadata.value = false;
  }
}

async function loadProfilerAndRoyale(): Promise<void> {
  try {
    const [prof, roy] = await Promise.all([
      apiGet<Record<string, unknown>>("/api/profile/status").catch(() => null),
      apiGet<Record<string, unknown>>("/api/royale/status").catch(() => null),
    ]);
    profilerStatus.value = prof;
    royaleStatus.value = roy;
  } catch {
    // Ignore
  }
}

onMounted(async () => {
  await runStore.fetchCheckpoints();
  if (!selectedLoraPath.value && runStore.allCheckpoints.length > 0) {
    selectedLoraPath.value = runStore.allCheckpoints[0]!.path;
  }
  await loadProfilerAndRoyale();
  if (activeTool.value === "metadata" && selectedLoraPath.value) {
    await inspectSafetensorsMetadata();
  }
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-canvas">
    <WorkbenchHeaderBar
      :active-tool="activeTool"
      :selected-lora-path="selectedLoraPath"
      :checkpoints="runStore.allCheckpoints"
      :selected-checkpoint="selectedCheckpoint"
      @set-tool="
        (tool) => {
          activeTool = tool;
          if (tool === 'metadata') void inspectSafetensorsMetadata();
        }
      "
      @select-lora="
        (path) => {
          selectedLoraPath = path;
          if (activeTool === 'metadata') void inspectSafetensorsMetadata();
        }
      "
      @refresh-checkpoints="runStore.fetchCheckpoints()"
    />

    <WorkbenchBlockStudio v-if="activeTool === 'studio'" :selected-lora-path="selectedLoraPath" />

    <WorkbenchLoraRoyale
      v-else-if="activeTool === 'royale'"
      :checkpoints="runStore.allCheckpoints"
      :royale-status="royaleStatus"
    />

    <WorkbenchBlockProfiler
      v-else-if="activeTool === 'profiler'"
      :profiler-status="profilerStatus"
    />

    <WorkbenchMetadataInspector
      v-else
      :metadata-json="metadataJson"
      :loading="loadingMetadata"
      @reload="inspectSafetensorsMetadata"
    />
  </div>
</template>
