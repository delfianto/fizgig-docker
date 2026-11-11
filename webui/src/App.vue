<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { RouterView, useRouter } from "vue-router";
import { Toaster } from "vue-sonner";
import { ApiError, apiGet, setUnauthorizedHandler } from "@/api/client";
import AppIconRail from "@/components/shell/AppIconRail.vue";
import LoginGateScreen from "@/components/shell/LoginGateScreen.vue";
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

const requiresAuth = ref(false);
const authChecked = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  stopPolling();
  pollTimer = setInterval(() => {
    if (requiresAuth.value) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    void runStore.pollRun();
    void runStore.pollStats();
  }, 2000);
}

function handleGlobalKeydown(e: KeyboardEvent): void {
  if (requiresAuth.value) return;
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
  if (
    !requiresAuth.value &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  ) {
    void runStore.pollRun();
    void runStore.pollStats();
  }
}

async function initializeWorkspace(): Promise<void> {
  try {
    await apiGet("/api/state", undefined, { skipAuthRedirect: true });
    requiresAuth.value = false;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      requiresAuth.value = true;
      authChecked.value = true;
      stopPolling();
      return;
    }
  }

  authChecked.value = true;

  await Promise.all([
    schemaStore.fetchSchema(true),
    schemaStore.fetchDatasets(),
    runStore.pollRun(),
    runStore.pollStats(),
    runStore.fetchHistoricalRuns(),
    runStore.fetchCheckpoints(),
    systemStore.fetchLocalBundles(),
  ]);

  const initialFamily =
    runStore.run?.running && runStore.run.family && schemaStore.getFamily(runStore.run.family)
      ? runStore.run.family
      : composerStore.resolvePreferredFamily();
  if (initialFamily) {
    await composerStore.selectFamily(initialFamily);
  }
  composerStore.ensureValidDatasetSelected();

  startPolling();
}

function handleLoggedOut(): void {
  stopPolling();
  runStore.clearSessionState();
  requiresAuth.value = true;
}

onMounted(async () => {
  setUnauthorizedHandler(() => {
    stopPolling();
    requiresAuth.value = true;
  });

  window.addEventListener("keydown", handleGlobalKeydown);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  await initializeWorkspace();
});

onUnmounted(() => {
  setUnauthorizedHandler(null);
  window.removeEventListener("keydown", handleGlobalKeydown);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopPolling();
});
</script>

<template>
  <div
    data-theme="fizgig"
    class="flex h-screen w-screen overflow-hidden bg-base-100 text-base-content antialiased selection:bg-primary/30"
  >
    <LoginGateScreen v-if="requiresAuth" @authenticated="initializeWorkspace" />

    <template v-else-if="authChecked">
      <AppIconRail @logged-out="handleLoggedOut" />

      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopTelemetryBar />
        <div class="min-h-0 flex-1 overflow-hidden">
          <RouterView />
        </div>
      </div>

      <PlanOverlayPopup />
    </template>

    <Teleport to="body">
      <Toaster theme="dark" rich-colors position="bottom-right" />
    </Teleport>
  </div>
</template>
