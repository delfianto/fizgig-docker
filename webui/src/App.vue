<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { RouterView, useRouter } from "vue-router";
import { Toaster } from "vue-sonner";
import AppIconRail from "@/components/shell/AppIconRail.vue";
import TopTelemetryBar from "@/components/shell/TopTelemetryBar.vue";
import PlanOverlayPopup from "@/components/common/PlanOverlayPopup.vue";
import { useSchemaStore } from "@/stores/schema";
import { useRunStore } from "@/stores/run";
import { useComposerStore } from "@/stores/composer";
import { useSystemStore } from "@/stores/system";

const router = useRouter();
const schemaStore = useSchemaStore();
const runStore = useRunStore();
const composerStore = useComposerStore();
const systemStore = useSystemStore();

let pollTimer: ReturnType<typeof setInterval> | null = null;

function handleGlobalKeydown(e: KeyboardEvent): void {
  const targetEl = e.target as HTMLElement | null;
  if (
    targetEl &&
    (targetEl.tagName === "INPUT" ||
      targetEl.tagName === "TEXTAREA" ||
      targetEl.tagName === "SELECT" ||
      targetEl.isContentEditable)
  ) {
    return;
  }

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const routes: Record<string, string> = {
      "1": "/cockpit",
      "2": "/composer",
      "3": "/datasets",
      "4": "/workbench",
      "5": "/system",
    };
    const target = routes[e.key];
    if (target) {
      e.preventDefault();
      void router.push(target);
    }
  }
}

function handleVisibilityChange(): void {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    void runStore.pollRun();
    void runStore.pollStats();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", handleGlobalKeydown);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  await Promise.all([
    schemaStore.fetchSchema(),
    schemaStore.fetchDatasets(),
    runStore.pollRun(),
    runStore.pollStats(),
    runStore.fetchHistoricalRuns(),
    runStore.fetchCheckpoints(),
    systemStore.fetchLocalBundles(),
  ]);

  // Initialize composer with active run family, active local bundle family, or schema default
  const initialFamily =
    runStore.run?.running && runStore.run.family && schemaStore.getFamily(runStore.run.family)
      ? runStore.run.family
      : composerStore.resolvePreferredFamily();
  if (initialFamily) {
    await composerStore.selectFamily(initialFamily);
  }
  composerStore.ensureValidDatasetSelected();

  pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    void runStore.pollRun();
    void runStore.pollStats();
  }, 2000);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template>
  <div
    data-theme="fizgig"
    class="flex h-screen w-screen overflow-hidden bg-base-100 text-base-content antialiased selection:bg-primary/30"
  >
    <AppIconRail />

    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <TopTelemetryBar />
      <div class="min-h-0 flex-1 overflow-hidden">
        <RouterView />
      </div>
    </div>

    <PlanOverlayPopup />
    <Teleport to="body">
      <Toaster theme="dark" rich-colors position="bottom-right" />
    </Teleport>
  </div>
</template>
