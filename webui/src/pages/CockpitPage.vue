<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Columns2,
  Copy,
  Download,
  Eye,
  FileCode2,
  History,
  ListOrdered,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RefreshCw,
  Terminal,
  Trash2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type HistoricalRun } from "@shared/types";
import { downloadUrl, formatBytes } from "@/api/client";
import LivePreviewDrawer from "@/components/telemetry/LivePreviewDrawer.vue";
import LossChartCanvas from "@/components/telemetry/LossChartCanvas.vue";
import SampleMatrixGrid from "@/components/telemetry/SampleMatrixGrid.vue";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";

const router = useRouter();
const runStore = useRunStore();
const composerStore = useComposerStore();

const activeSubView = ref<"live" | "queue" | "history">("live");
const bottomTab = ref<"checkpoints" | "console" | "spec">("checkpoints");
const highlightedEpoch = ref<number | null>(null);
const overrideDrawerOpen = ref(false);
const historySearch = ref("");
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

const progress = computed(() => runStore.run?.progress ?? null);

const displayedRunPrompts = computed(() => {
  if (runStore.samplePrompts.length > 0) return runStore.samplePrompts;
  const raw = String(runStore.run?.values?.SAMPLE_PROMPT ?? "");
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
});

const filteredHistory = computed(() => {
  const q = historySearch.value.trim().toLowerCase();
  if (!q) return runStore.historicalRuns;
  return runStore.historicalRuns.filter(
    (r) =>
      r.lora.toLowerCase().includes(q) ||
      r.family.toLowerCase().includes(q) ||
      (r.image_folder && r.image_folder.toLowerCase().includes(q)),
  );
});

function cloneRunToComposer(item: HistoricalRun): void {
  composerStore.loadFromHistoricalRun(item);
  toast.success(`Loaded settings from "${item.lora}" into Composer`);
  void router.push("/composer");
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
  await Promise.all([
    runStore.fetchLiveLoss(),
    runStore.fetchSamples(),
    runStore.fetchCheckpoints(),
  ]);
}

function renderMiniSparkline(vals?: number[]): string {
  if (!vals || vals.length < 2) return "";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1e-6, max - min);
  const w = 80;
  const h = 22;
  return vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

watch(
  () => runStore.run?.running,
  (running) => {
    if (running && inspectingHistoricalRun.value) {
      inspectingHistoricalRun.value = null;
      void runStore.fetchLiveLoss();
      void runStore.fetchSamples();
    }
  },
);

onMounted(async () => {
  await Promise.all([
    runStore.pollRun(),
    runStore.fetchHistoricalRuns(),
    runStore.fetchCheckpoints(),
  ]);

  if (!runStore.run?.running && runStore.historicalRuns.length > 0) {
    const latest = runStore.historicalRuns[0];
    if (latest) {
      await inspectRunSamplesAndLoss(latest);
    }
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
              activeSubView === 'live' ? 'bg-primary text-primary-content' : 'btn-ghost text-subtle'
            "
            @click="activeSubView = 'live'"
          >
            <Activity class="h-3.5 w-3.5" />
            <span>Live Cockpit</span>
          </button>

          <button
            type="button"
            class="btn btn-xs join-item border-0 gap-1.5 px-3"
            :class="
              activeSubView === 'queue'
                ? 'bg-primary text-primary-content'
                : 'btn-ghost text-subtle'
            "
            @click="activeSubView = 'queue'"
          >
            <ListOrdered class="h-3.5 w-3.5" />
            <span> Queue ({{ runStore.run?.web_queue?.items?.length ?? 0 }}) </span>
          </button>

          <button
            type="button"
            class="btn btn-xs join-item border-0 gap-1.5 px-3"
            :class="
              activeSubView === 'history'
                ? 'bg-primary text-primary-content'
                : 'btn-ghost text-subtle'
            "
            @click="
              activeSubView = 'history';
              runStore.fetchHistoricalRuns();
            "
          >
            <History class="h-3.5 w-3.5" />
            <span>Run History ({{ runStore.historicalRuns.length }})</span>
          </button>
        </div>

        <!-- Historical Inspection Indicator -->
        <div
          v-if="inspectingHistoricalRun"
          class="flex items-center gap-2 rounded border border-info/40 bg-info/10 px-2.5 py-0.5 text-xs text-info"
        >
          <span>
            Viewing historical run:
            <strong class="font-mono">{{ inspectingHistoricalRun.lora }}</strong>
          </span>
          <button
            type="button"
            class="underline hover:text-base-content"
            @click="switchBackToLiveRun"
          >
            Return to live run
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Quick Preview Pane Restore Button when collapsed -->
        <button
          v-if="activeSubView === 'live' && previewPaneMode === 'collapsed'"
          type="button"
          class="btn btn-xs btn-primary gap-1.5 shadow-xs"
          title="Restore preview pane"
          @click="setPreviewPaneMode('split')"
        >
          <Eye class="h-3 w-3" />
          <span>Show Previews ({{ runStore.samples.length }})</span>
          <PanelRightOpen class="h-3 w-3 ml-0.5 opacity-80" />
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
      <!-- Left Column: KPI Strip + Loss Chart + Checkpoints/Console/Spec -->
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
        <!-- 6-Card Tabular KPI Strip -->
        <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
            <div class="text-xs font-semibold tracking-wider text-muted uppercase">Epoch</div>
            <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
              {{
                progress
                  ? `${progress.epoch} / ${progress.total_epochs}`
                  : inspectingHistoricalRun
                    ? `${inspectingHistoricalRun.curve?.length ?? inspectingHistoricalRun.epoch ?? "—"} / ${inspectingHistoricalRun.values?.MAX_TRAIN_EPOCHS ?? inspectingHistoricalRun.epochs ?? inspectingHistoricalRun.curve?.length ?? "—"}`
                    : "—"
              }}
            </div>
          </div>

          <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
            <div class="text-xs font-semibold tracking-wider text-muted uppercase">Step</div>
            <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
              {{
                progress
                  ? `${progress.step} / ${progress.total_steps}`
                  : runStore.lossPoints.length || "—"
              }}
            </div>
          </div>

          <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
            <div class="text-xs font-semibold tracking-wider text-muted uppercase">Speed</div>
            <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
              {{ progress?.speed || "—" }}
            </div>
          </div>

          <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
            <div class="text-xs font-semibold tracking-wider text-muted uppercase">Loss</div>
            <div class="font-mono-num mt-1 text-xl font-bold text-primary">
              {{
                progress?.loss ||
                (runStore.lowestLossPoint ? runStore.lowestLossPoint.loss.toFixed(4) : "—")
              }}
            </div>
          </div>

          <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
            <div class="text-xs font-semibold tracking-wider text-muted uppercase">Grad Norm</div>
            <div class="font-mono-num mt-1 text-xl font-bold text-base-content">
              {{ progress?.grad_norm || "—" }}
            </div>
          </div>

          <div class="rounded-lg border border-hairline bg-base-300 px-3.5 py-2.5">
            <div class="text-xs font-semibold tracking-wider text-muted uppercase">Learn Rate</div>
            <div class="font-mono-num mt-1 text-xl font-bold text-warning">
              {{
                progress?.lr ||
                inspectingHistoricalRun?.values?.LEARNING_RATE ||
                runStore.run?.values?.LEARNING_RATE ||
                "—"
              }}
            </div>
          </div>
        </div>

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
        <div
          class="flex flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-base-300"
        >
          <div
            class="flex items-center justify-between border-b border-hairline bg-base-200 px-3 py-1.5 text-xs"
          >
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="btn btn-xs"
                :class="bottomTab === 'checkpoints' ? 'btn-primary' : 'btn-ghost text-subtle'"
                @click="bottomTab = 'checkpoints'"
              >
                <Download class="h-3 w-3" />
                Checkpoints ({{ runStore.checkpoints.length }})
              </button>

              <button
                type="button"
                class="btn btn-xs"
                :class="bottomTab === 'console' ? 'btn-primary' : 'btn-ghost text-subtle'"
                @click="
                  bottomTab = 'console';
                  runStore.pollLog();
                "
              >
                <Terminal class="h-3 w-3" />
                Console Log
              </button>

              <button
                type="button"
                class="btn btn-xs"
                :class="bottomTab === 'spec' ? 'btn-primary' : 'btn-ghost text-subtle'"
                @click="bottomTab = 'spec'"
              >
                <FileCode2 class="h-3 w-3" />
                Launch Spec
              </button>
            </div>

            <span class="font-mono text-[11px] text-muted">
              {{ runStore.activeOutputDir }}
            </span>
          </div>

          <!-- Tab 1: Checkpoints List -->
          <div
            v-if="bottomTab === 'checkpoints'"
            class="flex-1 divide-y divide-hairline overflow-y-auto text-xs"
          >
            <div v-if="runStore.checkpoints.length === 0" class="p-6 text-center text-muted">
              No checkpoints saved for this run yet.
            </div>
            <div
              v-for="ckpt in runStore.checkpoints"
              :key="ckpt.path"
              class="flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-hover"
            >
              <div class="flex items-center gap-3 overflow-hidden">
                <span class="font-mono text-sm font-semibold text-base-content">
                  {{ ckpt.name }}
                </span>
                <span
                  v-if="ckpt.epoch"
                  class="rounded bg-base-200 px-2 py-0.5 font-mono text-xs text-subtle"
                >
                  Epoch {{ ckpt.epoch }}
                </span>
              </div>

              <div class="flex shrink-0 items-center gap-3">
                <span class="font-mono-num text-xs text-muted">
                  {{ formatBytes(ckpt.size) }}
                </span>
                <a
                  :href="downloadUrl(ckpt.path)"
                  class="btn btn-sm btn-ghost border border-hairline bg-base-200 hover:border-primary text-xs"
                >
                  <Download class="h-3.5 w-3.5 text-primary" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Tab 2: Raw Console Stdout -->
          <div
            v-else-if="bottomTab === 'console'"
            class="flex-1 overflow-y-auto bg-base-100 p-3 font-mono text-[11px] leading-relaxed text-subtle"
          >
            <pre class="whitespace-pre-wrap">{{
              runStore.consoleLog || "No console output captured."
            }}</pre>
          </div>

          <!-- Tab 3: Launch Spec (Read-Only) -->
          <div
            v-else
            class="flex-1 overflow-y-auto bg-base-100 p-3 font-mono text-[11px] text-subtle"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="font-sans text-xs font-medium text-base-content">
                Frozen Launch Values ({{ inspectingHistoricalRun?.lora || runStore.run?.lora }})
              </span>
            </div>
            <pre class="whitespace-pre-wrap">{{
              JSON.stringify(inspectingHistoricalRun?.values ?? runStore.run?.values ?? {}, null, 2)
            }}</pre>
          </div>
        </div>
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

      <!-- Collapsed Right Edge Hover/Expand Strip -->
      <div
        v-if="previewPaneMode === 'collapsed'"
        class="absolute right-0 top-1/2 -translate-y-1/2 z-20"
      >
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-l-md border-y border-l border-hairline bg-base-300/95 px-1.5 py-3 text-xs text-subtle shadow-lg backdrop-blur hover:bg-base-200 hover:text-primary transition"
          title="Expand Preview Pane"
          @click="setPreviewPaneMode('split')"
        >
          <PanelRightOpen class="h-4 w-4 text-primary" />
          <span
            class="[writing-mode:vertical-rl] font-semibold tracking-wider text-[11px] uppercase"
          >
            Previews ({{ runStore.samples.length }})
          </span>
        </button>
      </div>
    </div>

    <!-- SUB-VIEW 2: QUEUE MANAGER -->
    <div v-else-if="activeSubView === 'queue'" class="flex-1 overflow-y-auto p-4">
      <div class="mx-auto max-w-5xl rounded-lg border border-hairline bg-base-300">
        <div
          class="flex items-center justify-between border-b border-hairline bg-base-200 px-4 py-3"
        >
          <div>
            <h2 class="text-sm font-semibold text-base-content">Shared Training Queue</h2>
            <p class="text-xs text-muted">
              Jobs run sequentially. Holding the queue prevents pending jobs from starting when the
              current run finishes.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="!runStore.run?.web_queue?.held"
              type="button"
              class="btn btn-sm btn-ghost border border-warning/40 bg-warning/10 text-warning"
              @click="runStore.holdQueue()"
            >
              <Pause class="h-3.5 w-3.5" />
              Hold Queue Dispatch
            </button>
            <button
              v-else
              type="button"
              class="btn btn-sm btn-primary"
              @click="runStore.startQueue()"
            >
              <Play class="h-3.5 w-3.5" />
              Release Hold &amp; Start Queue
            </button>
          </div>
        </div>

        <div class="divide-y divide-hairline">
          <div
            v-if="!runStore.run?.web_queue?.items?.length"
            class="p-8 text-center text-xs text-muted"
          >
            Queue is currently empty. Use the
            <strong class="text-base-content">Composer</strong> to validate and add runs to the
            queue.
          </div>

          <div
            v-for="(item, idx) in runStore.run?.web_queue?.items ?? []"
            :key="item.id"
            class="flex items-center justify-between px-4 py-3 text-xs hover:bg-surface-hover"
          >
            <div class="flex items-center gap-3">
              <span
                class="font-mono-num flex h-6 w-6 items-center justify-center rounded bg-base-200 text-subtle"
              >
                {{ idx + 1 }}
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono font-semibold text-base-content">
                    {{ item.lora }}
                  </span>
                  <span class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[10px]">
                    {{ item.family }}
                  </span>
                </div>
                <div class="mt-0.5 font-mono text-[11px] text-muted">
                  {{ item.image_folder }}
                  <span v-if="item.summary"> · {{ item.summary }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-hairline"
                :disabled="idx === 0"
                @click="runStore.moveQueueItem(item.id, -1)"
              >
                <ArrowUp class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-hairline"
                @click="runStore.moveQueueItem(item.id, 1)"
              >
                <ArrowDown class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost border border-error/30 text-error hover:bg-error/15"
                @click="runStore.removeQueueItem(item.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SUB-VIEW 3: HISTORICAL RUNS -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <div class="mx-auto max-w-6xl rounded-lg border border-hairline bg-base-300">
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-base-200 px-4 py-3"
        >
          <h2 class="text-sm font-semibold text-base-content">
            Run History ({{ filteredHistory.length }})
          </h2>
          <input
            v-model="historySearch"
            type="text"
            placeholder="Filter by LoRA name, model family, or dataset..."
            class="input input-sm w-72 border-hairline-strong bg-base-100 text-xs"
          />
        </div>

        <div class="divide-y divide-hairline text-xs">
          <div
            v-for="item in filteredHistory"
            :key="item.id"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover"
          >
            <div class="flex items-center gap-3">
              <span
                class="rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase"
                :class="
                  item.status === 'running'
                    ? 'bg-warning/15 text-warning'
                    : item.status === 'completed' || item.status === 'done'
                      ? 'bg-success/15 text-success'
                      : 'bg-base-200 text-subtle'
                "
              >
                {{ item.status || "saved" }}
              </span>

              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm font-semibold text-base-content">
                    {{ item.lora }}
                  </span>
                  <span class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                    {{ item.family_label || item.family }}
                  </span>
                </div>
                <div class="mt-0.5 font-mono text-[11px] text-muted">
                  Dataset: {{ item.image_folder }}
                  <span v-if="item.lowest_loss">
                    · Lowest loss:
                    <strong class="text-success">
                      {{ Number(item.lowest_loss).toFixed(4) }}
                    </strong>
                    <template v-if="item.lowest_epoch"> (ep {{ item.lowest_epoch }}) </template>
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <svg
                v-if="item.loss_spark && item.loss_spark.length > 1"
                width="82"
                height="24"
                class="rounded border border-hairline bg-base-100 px-0.5"
              >
                <path
                  :d="renderMiniSparkline(item.loss_spark)"
                  fill="none"
                  stroke="var(--color-primary)"
                  stroke-width="1.5"
                />
              </svg>

              <button
                type="button"
                class="btn btn-xs btn-ghost border border-hairline bg-base-200"
                @click="inspectRunSamplesAndLoss(item)"
              >
                <Activity class="h-3.5 w-3.5 text-primary" />
                Inspect Loss &amp; Samples
              </button>

              <button
                type="button"
                class="btn btn-xs btn-ghost border border-hairline bg-base-200"
                @click="cloneRunToComposer(item)"
              >
                <Copy class="h-3.5 w-3.5" />
                Clone to Composer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Safe, Explicit Live Preview Override Drawer -->
    <LivePreviewDrawer :open="overrideDrawerOpen" @close="overrideDrawerOpen = false" />
  </div>
</template>
