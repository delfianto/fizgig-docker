<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Activity, Eye, History, ListOrdered, RefreshCw } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type HistoricalRun } from "@shared/types";
import CockpitHistorySubView from "@/components/cockpit/CockpitHistorySubView.vue";
import CockpitQueueSubView from "@/components/cockpit/CockpitQueueSubView.vue";
import DismissSessionModal from "@/components/cockpit/DismissSessionModal.vue";
import InspectorTabsCard from "@/components/cockpit/InspectorTabsCard.vue";
import KpiMetricsStrip from "@/components/cockpit/KpiMetricsStrip.vue";
import LiveRunBanner from "@/components/cockpit/LiveRunBanner.vue";
import LivePreviewDrawer from "@/components/telemetry/LivePreviewDrawer.vue";
import LossChartCanvas from "@/components/telemetry/LossChartCanvas.vue";
import SampleMatrixGrid from "@/components/telemetry/SampleMatrixGrid.vue";
import { BaseButton, BasePillGroup } from "@/components/common";
import { splitSamplePrompts } from "@/utils";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";

const router = useRouter();
const runStore = useRunStore();
const composerStore = useComposerStore();

const activeSubView = ref<"live" | "queue" | "history">("live");
const highlightedEpoch = ref<number | null>(null);
const overrideDrawerOpen = ref(false);
const inspectingHistoricalRun = ref<HistoricalRun | null>(null);

export type PreviewPaneMode = "collapsed" | "split" | "wide";
const previewPaneMode = ref<PreviewPaneMode>(
  (typeof window !== "undefined" &&
    (localStorage.getItem("fizgig_cockpit_preview_pane") as PreviewPaneMode)) ||
    "split",
);

function setPreviewPaneMode(mode: PreviewPaneMode): void {
  previewPaneMode.value = mode;
  try {
    localStorage.setItem("fizgig_cockpit_preview_pane", mode);
  } catch {
    // Ignore storage write issues
  }
}

const DISMISSED_SESSION_KEY = "fizgig_dismissed_session";

function getInitialDismissedState(): boolean {
  try {
    const saved = localStorage.getItem(DISMISSED_SESSION_KEY);
    return Boolean(saved);
  } catch {
    return false;
  }
}

const sessionDismissed = ref(getInitialDismissedState());
const showDismissModal = ref(false);

const isMonitorDismissed = computed(() => sessionDismissed.value && !inspectingHistoricalRun.value);

const progress = computed(() => {
  if (isMonitorDismissed.value) return null;
  return runStore.run?.progress ?? null;
});

const displayedRunPrompts = computed(() => {
  if (isMonitorDismissed.value) return [];
  if (runStore.samplePrompts.length > 0) return runStore.samplePrompts;
  if (inspectingHistoricalRun.value) {
    return splitSamplePrompts(inspectingHistoricalRun.value.values?.SAMPLE_PROMPT);
  }
  if (runStore.hasLiveSession) {
    return splitSamplePrompts(runStore.run?.values?.SAMPLE_PROMPT);
  }
  return [];
});

function cloneRunToComposer(item: {
  family: string;
  image_folder?: string;
  values?: Record<string, unknown>;
  lora: string;
}): void {
  composerStore.loadFromHistoricalRun(item);
  toast.success(`Loaded settings from "${item.lora}" into Composer`);
  void router.push("/composer");
}

function requestDismissSession(): void {
  showDismissModal.value = true;
}

function confirmDismissSession(): void {
  showDismissModal.value = false;
  sessionDismissed.value = true;
  try {
    localStorage.setItem(
      DISMISSED_SESSION_KEY,
      runStore.run?.history_id || runStore.run?.lora || "true",
    );
  } catch {
    // Ignore storage write issues
  }
  runStore.clearSessionState();
  toast.success(`Cleared monitor session for "${runStore.run?.lora || "run"}"`);
}

async function restoreDismissedSession(): Promise<void> {
  sessionDismissed.value = false;
  try {
    localStorage.removeItem(DISMISSED_SESSION_KEY);
  } catch {
    // Ignore storage issues
  }
  if (runStore.run) {
    await Promise.all([
      runStore.fetchLiveLoss(runStore.run.history_id || undefined),
      runStore.fetchSamples(undefined, runStore.run.lora),
      runStore.fetchCheckpoints(runStore.run.output_dir, runStore.run.lora),
    ]);
    toast.info(`Restored monitor view for "${runStore.run.lora}"`);
  }
}

async function inspectRunSamplesAndLoss(item: HistoricalRun): Promise<void> {
  inspectingHistoricalRun.value = item;
  await Promise.all([
    runStore.fetchLiveLoss(item.id),
    runStore.fetchSamples(`${item.output_dir}/sample`, item.lora),
    runStore.fetchCheckpoints(item.output_dir, item.lora),
  ]);
  activeSubView.value = "live";
}

async function switchBackToLiveRun(): Promise<void> {
  inspectingHistoricalRun.value = null;
  if (runStore.isActiveOrStarting) {
    sessionDismissed.value = false;
    try {
      localStorage.removeItem(DISMISSED_SESSION_KEY);
    } catch {
      // Ignore
    }
    await Promise.all([
      runStore.fetchLiveLoss(),
      runStore.fetchSamples(),
      runStore.fetchCheckpoints(),
    ]);
  } else if (runStore.isCompleted && runStore.run) {
    if (!sessionDismissed.value) {
      await Promise.all([
        runStore.fetchLiveLoss(runStore.run.history_id || undefined),
        runStore.fetchSamples(undefined, runStore.run.lora),
        runStore.fetchCheckpoints(runStore.run.output_dir, runStore.run.lora),
      ]);
    } else {
      runStore.clearSessionState();
    }
  } else {
    runStore.clearSessionState();
  }
}

watch(
  () => runStore.run?.running,
  (running) => {
    if (running) {
      sessionDismissed.value = false;
      try {
        localStorage.removeItem(DISMISSED_SESSION_KEY);
      } catch {
        // Ignore
      }
      if (inspectingHistoricalRun.value) {
        inspectingHistoricalRun.value = null;
        void runStore.fetchLiveLoss();
        void runStore.fetchSamples();
      }
    }
  },
);

onMounted(async () => {
  await Promise.all([
    runStore.pollRun(),
    runStore.fetchHistoricalRuns(),
    runStore.fetchCheckpoints(),
  ]);

  if (runStore.isActiveOrStarting) {
    sessionDismissed.value = false;
    try {
      localStorage.removeItem(DISMISSED_SESSION_KEY);
    } catch {
      // Ignore
    }
    inspectingHistoricalRun.value = null;
    await Promise.all([runStore.fetchLiveLoss(), runStore.fetchSamples()]);
  } else if (runStore.isCompleted && runStore.run) {
    inspectingHistoricalRun.value = null;
    const currentRunKey = runStore.run.history_id || runStore.run.lora;
    let savedDismissed: string | null = null;
    try {
      savedDismissed = localStorage.getItem(DISMISSED_SESSION_KEY);
    } catch {
      // Ignore
    }
    if (savedDismissed && (savedDismissed === currentRunKey || savedDismissed === "true")) {
      sessionDismissed.value = true;
      runStore.clearSessionState();
    } else {
      sessionDismissed.value = false;
      await Promise.all([
        runStore.fetchLiveLoss(runStore.run.history_id || undefined),
        runStore.fetchSamples(undefined, runStore.run.lora),
        runStore.fetchCheckpoints(runStore.run.output_dir, runStore.run.lora),
      ]);
    }
  } else {
    runStore.clearSessionState();
  }
  if (!isMonitorDismissed.value && runStore.isActiveOrStarting) {
    runStore.startLogStream();
  }
});

onUnmounted(() => {
  runStore.stopLogStream();
});
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-canvas">
    <!-- Sub-Navigation Header Bar -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-hairline bg-base-200 px-4 py-2"
    >
      <div class="flex items-center gap-2">
        <BasePillGroup
          :model-value="activeSubView"
          :options="[
            { value: 'live', label: 'Monitor', icon: Activity },
            { value: 'queue', label: 'Queue', icon: ListOrdered },
            { value: 'history', label: 'History', icon: History },
          ]"
          @update:model-value="
            (val) => {
              activeSubView = val as 'live' | 'queue' | 'history';
              if (val === 'history') runStore.fetchHistoricalRuns();
            }
          "
        />

        <!-- Historical Inspection Indicator -->
        <div
          v-if="inspectingHistoricalRun"
          class="flex h-8.5 items-center gap-2 rounded-lg border border-info/40 bg-info/10 px-3 text-xs text-info"
        >
          <span class="flex items-center gap-1">
            <span class="text-subtle">Inspecting Archive:</span>
            <strong class="font-mono text-base-content">{{ inspectingHistoricalRun.lora }}</strong>
          </span>
          <button
            type="button"
            class="underline hover:text-base-content cursor-pointer text-xs"
            @click="switchBackToLiveRun"
          >
            {{ runStore.isActiveOrStarting ? "Return to active run" : "Close archive view" }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Preview Pane Toggle Button -->
        <BaseButton
          v-if="activeSubView === 'live'"
          :variant="previewPaneMode !== 'collapsed' ? 'ghost' : 'primary'"
          :title="previewPaneMode !== 'collapsed' ? 'Hide preview pane' : 'Show preview pane'"
          @click="setPreviewPaneMode(previewPaneMode === 'collapsed' ? 'split' : 'collapsed')"
        >
          <template #icon-left><Eye class="h-3.5 w-3.5" /></template>
          <span>Preview</span>
        </BaseButton>

        <BaseButton
          variant="ghost"
          size="compact"
          title="Refresh telemetry, samples, and checkpoints"
          @click="
            async () => {
              await runStore.pollRun();
              await runStore.pollStats();
              if (inspectingHistoricalRun) {
                runStore.fetchLiveLoss(inspectingHistoricalRun.id);
                runStore.fetchSamples(
                  `${inspectingHistoricalRun.output_dir}/sample`,
                  inspectingHistoricalRun.lora,
                );
                runStore.fetchCheckpoints(
                  inspectingHistoricalRun.output_dir,
                  inspectingHistoricalRun.lora,
                );
                runStore.pollLog();
              } else if (
                !isMonitorDismissed &&
                (runStore.isActiveOrStarting || (runStore.isCompleted && runStore.run))
              ) {
                runStore.fetchLiveLoss(runStore.run?.history_id || undefined);
                runStore.fetchSamples(undefined, runStore.run?.lora);
                runStore.fetchCheckpoints(runStore.run?.output_dir, runStore.run?.lora);
                runStore.pollLog();
              }
            }
          "
        >
          <template #icon-left><RefreshCw class="h-3.5 w-3.5" /></template>
          <span>Refresh</span>
        </BaseButton>
      </div>
    </div>

    <!-- SUB-VIEW 1: SPLIT-PANE LIVE COCKPIT (Left Telemetry + Right Sample Matrix) -->
    <div
      v-if="activeSubView === 'live'"
      class="relative grid w-full flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12"
    >
      <!-- Left Column: Live Run Banner + KPI Strip + Loss Chart + Inspector Card -->
      <div
        class="flex flex-col gap-3 overflow-y-auto border-r border-hairline p-3.5 transition-all duration-200"
        :class="
          previewPaneMode === 'collapsed'
            ? 'lg:col-span-12'
            : previewPaneMode === 'wide'
              ? 'lg:col-span-4'
              : 'lg:col-span-7'
        "
      >
        <!-- Live / Completed / Standby Run Status & Instant Controls -->
        <LiveRunBanner
          :inspecting-historical-run="inspectingHistoricalRun"
          :session-dismissed="sessionDismissed"
          :latest-historical-run="runStore.historicalRuns[0] ?? null"
          @clone="cloneRunToComposer"
          @dismiss="requestDismissSession"
          @restore-session="restoreDismissedSession"
          @inspect-latest="
            runStore.historicalRuns[0] && inspectRunSamplesAndLoss(runStore.historicalRuns[0])
          "
          @view-history="activeSubView = 'history'"
          @return-to-live="switchBackToLiveRun"
        />

        <!-- 6-Card Tabular KPI Strip -->
        <KpiMetricsStrip
          :progress="progress"
          :inspecting-historical-run="inspectingHistoricalRun"
          :loss-points="isMonitorDismissed ? [] : runStore.lossPoints"
          :lowest-loss-point="isMonitorDismissed ? null : runStore.lowestLossPoint"
          :run-values="
            isMonitorDismissed || (!runStore.hasLiveSession && !inspectingHistoricalRun)
              ? undefined
              : runStore.run?.values
          "
          :pane-mode="previewPaneMode"
        />

        <!-- Loss Chart Card -->
        <div class="rounded-lg border border-hairline bg-base-300 p-3.5">
          <LossChartCanvas
            :points="isMonitorDismissed ? [] : runStore.lossPoints"
            :total-steps="progress?.total_steps"
            :total-epochs="progress?.total_epochs"
            @hover-epoch="(ep) => (highlightedEpoch = ep)"
          />
        </div>

        <!-- Bottom Inspector Card: Checkpoints | Console Log | Active Spec -->
        <InspectorTabsCard
          :checkpoints="isMonitorDismissed ? [] : runStore.checkpoints"
          :output-dir="
            isMonitorDismissed
              ? '—'
              : inspectingHistoricalRun
                ? inspectingHistoricalRun.output_dir
                : runStore.hasLiveSession
                  ? runStore.activeOutputDir
                  : '—'
          "
          :console-log="isMonitorDismissed ? '' : runStore.consoleLog"
          :inspecting-historical-run="inspectingHistoricalRun"
          :active-lora="isMonitorDismissed ? null : runStore.activeLoraName || null"
          :spec-values="
            isMonitorDismissed
              ? null
              : (inspectingHistoricalRun?.values ??
                (runStore.hasLiveSession ? runStore.run?.values : null) ??
                null)
          "
        />
      </div>

      <!-- Right Column: Epoch × Prompt Sample Matrix / Carousel -->
      <div
        v-if="previewPaneMode !== 'collapsed'"
        class="flex h-full flex-col overflow-hidden transition-all duration-200"
        :class="previewPaneMode === 'wide' ? 'lg:col-span-8' : 'lg:col-span-5'"
      >
        <SampleMatrixGrid
          :items="isMonitorDismissed ? [] : runStore.samples"
          :prompts="displayedRunPrompts"
          :highlighted-epoch="highlightedEpoch"
          :mode-note="isMonitorDismissed ? '' : runStore.sampleModeNote"
          :pane-mode="previewPaneMode"
          @set-pane-mode="(mode) => setPreviewPaneMode(mode)"
          @open-override-drawer="overrideDrawerOpen = true"
        />
      </div>
    </div>

    <!-- SUB-VIEW 2: QUEUE MANAGER -->
    <CockpitQueueSubView v-else-if="activeSubView === 'queue'" />

    <!-- SUB-VIEW 3: HISTORICAL RUNS -->
    <CockpitHistorySubView
      v-else
      :historical-runs="runStore.historicalRuns"
      @inspect="inspectRunSamplesAndLoss"
      @clone="cloneRunToComposer"
    />

    <!-- Safe, Explicit Live Preview Override Drawer -->
    <LivePreviewDrawer :open="overrideDrawerOpen" @close="overrideDrawerOpen = false" />

    <!-- Dismiss Session Confirmation Modal -->
    <DismissSessionModal
      :open="showDismissModal"
      :lora-name="runStore.run?.lora"
      @confirm="confirmDismissSession"
      @close="showDismissModal = false"
    />
  </div>
</template>
