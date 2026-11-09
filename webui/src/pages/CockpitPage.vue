<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  History,
  ListOrdered,
  RefreshCw,
  X,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type HistoricalRun } from "@shared/types";
import CockpitHistorySubView from "@/components/cockpit/CockpitHistorySubView.vue";
import CockpitQueueSubView from "@/components/cockpit/CockpitQueueSubView.vue";
import InspectorTabsCard from "@/components/cockpit/InspectorTabsCard.vue";
import KpiMetricsStrip from "@/components/cockpit/KpiMetricsStrip.vue";
import LiveRunBanner from "@/components/cockpit/LiveRunBanner.vue";
import LivePreviewDrawer from "@/components/telemetry/LivePreviewDrawer.vue";
import LossChartCanvas from "@/components/telemetry/LossChartCanvas.vue";
import SampleMatrixGrid from "@/components/telemetry/SampleMatrixGrid.vue";
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

const sessionDismissed = ref(false);
const showDismissModal = ref(false);

const progress = computed(() => {
  if (sessionDismissed.value && !inspectingHistoricalRun.value) return null;
  return runStore.run?.progress ?? null;
});

const displayedRunPrompts = computed(() => {
  if (runStore.samplePrompts.length > 0) return runStore.samplePrompts;
  const raw = String(runStore.run?.values?.SAMPLE_PROMPT ?? "");
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
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
  runStore.clearSessionState();
  toast.success(`Cleared monitor session for "${runStore.run?.lora || "run"}"`);
}

async function restoreDismissedSession(): Promise<void> {
  sessionDismissed.value = false;
  if (runStore.run) {
    await Promise.all([
      runStore.fetchLiveLoss(runStore.run.history_id || undefined),
      runStore.fetchSamples(undefined, runStore.run.lora),
      runStore.fetchCheckpoints(runStore.run.output_dir),
    ]);
    toast.info(`Restored monitor view for "${runStore.run.lora}"`);
  }
}

async function inspectRunSamplesAndLoss(item: HistoricalRun): Promise<void> {
  inspectingHistoricalRun.value = item;
  await Promise.all([
    runStore.fetchLiveLoss(item.id),
    runStore.fetchSamples(`${item.output_dir}/sample`, item.lora),
    runStore.fetchCheckpoints(item.output_dir),
  ]);
  activeSubView.value = "live";
}

async function switchBackToLiveRun(): Promise<void> {
  inspectingHistoricalRun.value = null;
  sessionDismissed.value = false;
  if (runStore.isActiveOrStarting) {
    await Promise.all([
      runStore.fetchLiveLoss(),
      runStore.fetchSamples(),
      runStore.fetchCheckpoints(),
    ]);
  } else if (runStore.isCompleted && runStore.run) {
    await Promise.all([
      runStore.fetchLiveLoss(runStore.run.history_id || undefined),
      runStore.fetchSamples(undefined, runStore.run.lora),
      runStore.fetchCheckpoints(runStore.run.output_dir),
    ]);
  } else {
    await Promise.all([
      runStore.fetchLiveLoss(),
      runStore.fetchSamples(),
      runStore.fetchCheckpoints(),
    ]);
  }
}

watch(
  () => runStore.run?.running,
  (running) => {
    if (running) {
      sessionDismissed.value = false;
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
    inspectingHistoricalRun.value = null;
    await Promise.all([runStore.fetchLiveLoss(), runStore.fetchSamples()]);
  } else if (runStore.isCompleted && runStore.run) {
    inspectingHistoricalRun.value = null;
    await Promise.all([
      runStore.fetchLiveLoss(runStore.run.history_id || undefined),
      runStore.fetchSamples(undefined, runStore.run.lora),
      runStore.fetchCheckpoints(runStore.run.output_dir),
    ]);
  } else {
    await Promise.all([runStore.fetchLiveLoss(), runStore.fetchSamples()]);
  }
  runStore.startLogStream();
});

onUnmounted(() => {
  runStore.stopLogStream();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-canvas">
    <!-- Sub-Navigation Header Bar -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-hairline bg-base-200 px-4 py-2"
    >
      <div class="flex items-center gap-2">
        <div class="join rounded-md border border-hairline bg-base-300 p-0.5">
          <button
            type="button"
            class="btn btn-xs join-item border-0 gap-1.5 px-3"
            :class="
              activeSubView === 'live'
                ? 'bg-primary text-primary-content font-bold'
                : 'btn-ghost text-subtle'
            "
            @click="activeSubView = 'live'"
          >
            <Activity class="h-3.5 w-3.5" />
            <span>Monitor</span>
          </button>

          <button
            type="button"
            class="btn btn-xs join-item border-0 gap-1.5 px-3"
            :class="
              activeSubView === 'queue'
                ? 'bg-primary text-primary-content font-bold'
                : 'btn-ghost text-subtle'
            "
            @click="activeSubView = 'queue'"
          >
            <ListOrdered class="h-3.5 w-3.5" />
            <span>Queue</span>
          </button>

          <button
            type="button"
            class="btn btn-xs join-item border-0 gap-1.5 px-3"
            :class="
              activeSubView === 'history'
                ? 'bg-primary text-primary-content font-bold'
                : 'btn-ghost text-subtle'
            "
            @click="
              activeSubView = 'history';
              runStore.fetchHistoricalRuns();
            "
          >
            <History class="h-3.5 w-3.5" />
            <span>History</span>
          </button>
        </div>

        <!-- Historical Inspection Indicator -->
        <div
          v-if="inspectingHistoricalRun"
          class="flex items-center gap-2 rounded border border-info/40 bg-info/10 px-2.5 py-0.5 text-xs text-info"
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
        <button
          v-if="activeSubView === 'live'"
          type="button"
          class="btn btn-xs gap-1.5 border border-hairline transition"
          :class="
            previewPaneMode !== 'collapsed'
              ? 'bg-base-300 text-base-content hover:border-primary/50'
              : 'btn-primary shadow-xs'
          "
          :title="previewPaneMode !== 'collapsed' ? 'Hide preview pane' : 'Show preview pane'"
          @click="setPreviewPaneMode(previewPaneMode === 'collapsed' ? 'split' : 'collapsed')"
        >
          <Eye class="h-3 w-3" />
          <span>Preview</span>
        </button>

        <button
          type="button"
          class="btn btn-xs btn-ghost border border-hairline bg-base-300"
          title="Refresh telemetry, samples, and checkpoints"
          @click="
            runStore.pollRun();
            runStore.fetchLiveLoss(inspectingHistoricalRun?.id);
            runStore.fetchSamples(
              inspectingHistoricalRun ? `${inspectingHistoricalRun.output_dir}/sample` : undefined,
              inspectingHistoricalRun?.lora,
            );
            runStore.fetchCheckpoints(inspectingHistoricalRun?.output_dir);
            runStore.pollLog();
          "
        >
          <RefreshCw class="h-3 w-3" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- SUB-VIEW 1: SPLIT-PANE LIVE COCKPIT (Left Telemetry + Right Sample Matrix) -->
    <div
      v-if="activeSubView === 'live'"
      class="relative grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12"
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
          @clone="cloneRunToComposer"
          @dismiss="requestDismissSession"
          @restore-session="restoreDismissedSession"
          @view-history="activeSubView = 'history'"
          @return-to-live="switchBackToLiveRun"
        />

        <!-- 6-Card Tabular KPI Strip -->
        <KpiMetricsStrip
          :progress="progress"
          :inspecting-historical-run="inspectingHistoricalRun"
          :loss-points="runStore.lossPoints"
          :lowest-loss-point="runStore.lowestLossPoint"
          :run-values="runStore.run?.values"
        />

        <!-- Loss Chart Card -->
        <div class="rounded-lg border border-hairline bg-base-300 p-3.5">
          <LossChartCanvas
            :points="runStore.lossPoints"
            :total-steps="progress?.total_steps"
            :total-epochs="progress?.total_epochs"
            @hover-epoch="(ep) => (highlightedEpoch = ep)"
          />
        </div>

        <!-- Bottom Inspector Card: Checkpoints | Console Log | Active Spec -->
        <InspectorTabsCard
          :checkpoints="runStore.checkpoints"
          :output-dir="runStore.activeOutputDir"
          :console-log="runStore.consoleLog"
          :inspecting-historical-run="inspectingHistoricalRun"
        />
      </div>

      <!-- Right Column: Epoch × Prompt Sample Matrix / Carousel -->
      <div
        v-if="previewPaneMode !== 'collapsed'"
        class="flex h-full flex-col overflow-hidden transition-all duration-200"
        :class="previewPaneMode === 'wide' ? 'lg:col-span-8' : 'lg:col-span-5'"
      >
        <SampleMatrixGrid
          :items="runStore.samples"
          :prompts="displayedRunPrompts"
          :highlighted-epoch="highlightedEpoch"
          :mode-note="runStore.sampleModeNote"
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
    <dialog v-if="showDismissModal" class="modal modal-open">
      <div class="modal-box max-w-md border border-hairline bg-base-300 p-5 shadow-2xl">
        <div class="flex items-center gap-3 border-b border-hairline pb-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 border border-warning/30 text-warning shrink-0"
          >
            <AlertTriangle class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-base-content">Dismiss Completed Run?</h3>
            <p class="text-xs text-muted">Clear the active monitor and return to standby.</p>
          </div>
        </div>

        <div class="py-4 space-y-2.5 text-xs text-subtle leading-relaxed">
          <p>
            You are about to dismiss the completed session for
            <strong class="font-mono text-base-content">{{ runStore.run?.lora }}</strong
            >.
          </p>
          <div class="rounded-lg border border-hairline bg-base-200 p-3 space-y-1.5">
            <div class="flex items-center gap-1.5 text-success font-medium">
              <CheckCircle2 class="h-4 w-4 shrink-0" />
              <span>Safe action: Your weights and logs are preserved</span>
            </div>
            <p class="text-[11px] text-muted">
              All <strong>.safetensors</strong> model weights, checkpoints, and execution history
              remain permanently stored in
              <code class="text-xs font-mono">/workspace/output_loras</code> and the
              <strong>History</strong> tab.
            </p>
          </div>
          <p class="text-[11px] text-muted">
            This will reset the active loss curves, logs, checkpoints, and sample previews from the
            monitor screen so you can start clean.
          </p>
        </div>

        <div
          class="modal-action mt-2 flex items-center justify-end gap-2 border-t border-hairline pt-3"
        >
          <button
            type="button"
            class="btn btn-xs btn-ghost border border-hairline bg-base-200 cursor-pointer"
            @click="showDismissModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-xs btn-warning gap-1 font-semibold cursor-pointer"
            @click="confirmDismissSession"
          >
            <X class="h-3.5 w-3.5" />
            <span>Dismiss &amp; Clear Monitor</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop bg-black/60" @click="showDismissModal = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
