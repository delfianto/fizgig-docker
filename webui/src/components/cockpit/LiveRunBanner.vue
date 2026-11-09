<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  History,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  X,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type HistoricalRun } from "@shared/types";
import { useRunStore } from "@/stores/run";

const props = withDefaults(
  defineProps<{
    inspectingHistoricalRun?: HistoricalRun | null;
    sessionDismissed?: boolean;
  }>(),
  {
    inspectingHistoricalRun: null,
    sessionDismissed: false,
  },
);

const emit = defineEmits<{
  (
    e: "clone",
    run: {
      family: string;
      image_folder?: string;
      values?: Record<string, unknown>;
      lora: string;
    },
  ): void;
  (e: "dismiss"): void;
  (e: "view-history"): void;
  (e: "return-to-live"): void;
}>();

const runStore = useRunStore();

const confirmStop = ref(false);
const busyAction = ref<string | null>(null);

const progress = computed(() => runStore.run?.progress ?? null);

const liveStageText = computed(() => {
  if (!runStore.run) return "Idle";
  if (runStore.run.pause) return "Pausing at Epoch";
  if (runStore.run.stage) return runStore.run.stage;
  if (runStore.run.running) return "Training";
  return "Starting";
});

function formatDuration(sec?: number | null): string {
  if (!sec || isNaN(sec) || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(timestamp?: number | null): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

const completedDurationText = computed(() => {
  const r = runStore.run;
  if (!r?.started_at || !r?.ended_at) return "";
  return formatDuration(r.ended_at - r.started_at);
});

const completedArtifactPath = computed(() => {
  const r = runStore.run;
  if (!r?.lora) return "";
  const dir = r.output_dir || "/workspace/output_loras";
  return `${dir}/${r.lora}.safetensors`;
});

async function copyPath(text: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied artifact path to clipboard");
  } catch {
    toast.info(text);
  }
}

async function handleAction(
  name: string,
  fn: () => Promise<void>,
  successMsg: string,
): Promise<void> {
  busyAction.value = name;
  try {
    await fn();
    toast.success(successMsg);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Action failed");
  } finally {
    busyAction.value = null;
    confirmStop.value = false;
  }
}
</script>

<template>
  <div>
    <!-- STATE 1: Historical Archive Inspection Banner -->
    <section
      v-if="inspectingHistoricalRun"
      class="rounded-xl border border-info/30 bg-info/5 p-4 shadow-xs space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-info/20 pb-3">
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <span
            class="rounded bg-info/15 border border-info/30 px-2 py-0.5 text-xs font-semibold text-info flex items-center gap-1.5"
          >
            <History class="h-3.5 w-3.5" />
            <span>Archived Run</span>
          </span>
          <span class="text-sm font-bold font-mono text-base-content truncate">
            {{ inspectingHistoricalRun.lora }}
          </span>
          <span class="badge badge-sm badge-neutral border-hairline font-mono text-[11px]">
            {{ inspectingHistoricalRun.family_label || inspectingHistoricalRun.family }}
          </span>
          <span
            v-if="inspectingHistoricalRun.status || inspectingHistoricalRun.result"
            class="badge badge-sm badge-ghost border-hairline font-mono text-[11px] capitalize"
          >
            {{ inspectingHistoricalRun.status || inspectingHistoricalRun.result }}
          </span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            class="btn btn-xs border border-hairline bg-base-200 hover:border-primary/50 text-xs gap-1"
            title="Load this historical run's settings into Composer"
            @click="emit('clone', inspectingHistoricalRun)"
          >
            <Copy class="h-3.5 w-3.5 text-primary" />
            <span>Clone to Composer</span>
          </button>

          <button
            type="button"
            class="btn btn-xs gap-1 text-xs"
            :class="
              runStore.isActiveOrStarting
                ? 'btn-warning animate-pulse'
                : 'btn-ghost border border-hairline bg-base-200'
            "
            @click="emit('return-to-live')"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            <span>{{
              runStore.isActiveOrStarting ? "Return to Active Run" : "Close Archive View"
            }}</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted font-mono">
        <div class="flex items-center gap-2 truncate">
          <span
            >Dataset:
            <span class="text-base-content">{{ inspectingHistoricalRun.image_folder }}</span></span
          >
          <span v-if="inspectingHistoricalRun.lowest_loss">
            · Lowest loss:
            <strong class="text-success">{{
              Number(inspectingHistoricalRun.lowest_loss).toFixed(4)
            }}</strong>
            <template v-if="inspectingHistoricalRun.lowest_epoch">
              (ep {{ inspectingHistoricalRun.lowest_epoch }})</template
            >
          </span>
        </div>
        <div v-if="inspectingHistoricalRun.ended_at || inspectingHistoricalRun.finished_at">
          Finished:
          {{ formatTime(inspectingHistoricalRun.ended_at || inspectingHistoricalRun.finished_at) }}
        </div>
      </div>
    </section>

    <!-- STATE 2: Live Run Status & Instant Controls Card -->
    <section
      v-else-if="runStore.isActiveOrStarting && runStore.run"
      class="rounded-xl border border-hairline bg-base-300 p-4 shadow-xs space-y-3"
    >
      <!-- Top Row: Stage & Run Identity on Left, Instant Controls on Right -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <span class="text-sm font-bold font-mono text-base-content truncate">
            {{ runStore.run.lora }}
          </span>
          <span class="badge badge-sm badge-neutral border-hairline font-mono text-[11px]">
            {{ runStore.run.family }}
          </span>
          <span
            class="rounded px-2 py-0.5 text-xs font-semibold"
            :class="
              runStore.run.pause
                ? 'bg-warning/10 border border-warning/30 text-warning'
                : 'bg-primary/10 border border-primary/20 text-primary'
            "
          >
            {{ liveStageText }}
          </span>
        </div>

        <!-- Instant Training Controls -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            class="btn btn-xs border border-hairline bg-base-200 hover:border-primary/50 text-xs gap-1"
            :disabled="busyAction !== null"
            title="Render sample previews after current step"
            @click="
              handleAction(
                'sample',
                () => runStore.triggerSampleNow(),
                'Requested preview sample after current step',
              )
            "
          >
            <Camera class="h-3.5 w-3.5 text-primary" />
            <span>Sample Now</span>
          </button>

          <button
            type="button"
            class="btn btn-xs border border-hairline bg-base-200 hover:border-success/50 text-xs gap-1"
            :disabled="busyAction !== null"
            title="Save a checkpoint after current step"
            @click="
              handleAction(
                'save',
                () => runStore.triggerSaveNow(),
                'Requested checkpoint save after current step',
              )
            "
          >
            <Save class="h-3.5 w-3.5 text-success" />
            <span>Save Now</span>
          </button>

          <button
            type="button"
            class="btn btn-xs border border-hairline bg-base-200 hover:border-warning/50 text-xs gap-1"
            :disabled="busyAction !== null || runStore.run.pause"
            title="Request clean pause at next epoch boundary"
            @click="
              handleAction(
                'pause',
                () => runStore.pauseTraining(),
                'Pause requested for next epoch boundary',
              )
            "
          >
            <Pause class="h-3.5 w-3.5 text-warning" />
            <span>{{ runStore.run.pause ? "Pausing…" : "Pause" }}</span>
          </button>

          <!-- Two-step Stop Guard -->
          <div class="relative flex items-center">
            <button
              v-if="!confirmStop"
              type="button"
              class="btn btn-xs border border-error/30 bg-error/10 text-error hover:bg-error/20 text-xs gap-1"
              title="Stop active training run"
              @click="confirmStop = true"
            >
              <Square class="h-3 w-3" />
              <span>Stop</span>
            </button>
            <div
              v-else
              class="flex items-center gap-1 rounded border border-error/50 bg-base-200 px-1.5 py-0.5"
            >
              <span class="text-[11px] font-medium text-error">Stop run?</span>
              <button
                type="button"
                class="btn btn-xs btn-error h-5 min-h-0 px-2 text-[11px]"
                @click="handleAction('stop', () => runStore.stopTraining(), 'Stopped training run')"
              >
                Confirm
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost h-5 min-h-0 px-1.5 text-[11px]"
                @click="confirmStop = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Row: Active Training vs Caching/Preparing State -->
      <div v-if="progress" class="space-y-2">
        <div class="flex items-center justify-between text-xs text-subtle font-mono-num gap-3">
          <div class="flex items-center gap-2 sm:gap-2.5 whitespace-nowrap">
            <span>
              Epoch
              <strong class="text-base-content"
                >{{ progress.epoch }} / {{ progress.total_epochs }}</strong
              >
            </span>
            <span class="text-muted">·</span>
            <span>
              Step
              <strong class="text-base-content"
                >{{ progress.step }} / {{ progress.total_steps }}</strong
              >
            </span>
            <span class="text-muted">·</span>
            <span>
              Loss <strong class="text-primary">{{ progress.loss }}</strong>
            </span>
          </div>
          <div class="flex items-center gap-2 sm:gap-2.5 whitespace-nowrap shrink-0">
            <span class="hidden sm:inline">{{ progress.speed }}</span>
            <span class="hidden sm:inline text-muted">·</span>
            <span>
              ETA <strong class="text-base-content">{{ progress.eta }}</strong>
            </span>
            <span
              class="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 font-mono font-bold text-primary text-[11px]"
            >
              {{ progress.percent.toFixed(1) }}%
            </span>
          </div>
        </div>

        <!-- Full-width Progress Bar -->
        <div class="h-2 w-full overflow-hidden rounded-full bg-base-100">
          <div
            class="h-full bg-primary transition-all duration-300"
            :style="{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }"
          />
        </div>

        <!-- Optional Stage Note / Detail -->
        <div v-if="progress.note" class="text-xs text-muted font-mono truncate">
          {{ progress.note }}
        </div>
      </div>

      <!-- Caching / Preparing Latents / Pre-Step 1 State -->
      <div v-else class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 text-warning font-medium">
            <span class="loading loading-spinner loading-xs text-warning" />
            <span>{{
              runStore.run.stage || "Preparing environment and caching dataset latents..."
            }}</span>
          </div>
          <span class="text-subtle font-mono text-[11px]">Awaiting step 1 telemetry</span>
        </div>

        <div class="h-2 w-full overflow-hidden rounded-full bg-base-100">
          <div class="h-full w-1/3 animate-pulse bg-warning rounded-full" />
        </div>

        <div v-if="runStore.run.image_folder" class="text-xs text-subtle font-mono truncate">
          Dataset: {{ runStore.run.image_folder }}
        </div>
      </div>
    </section>

    <!-- STATE 3: Paused Resume Banner (when trainer is idle but has a resumable run) -->
    <section
      v-else-if="runStore.run?.resume"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs"
    >
      <div class="flex items-center gap-2.5">
        <Pause class="h-4 w-4 text-warning" />
        <div>
          <span class="font-medium text-warning">Paused run ready to resume:</span>
          <strong class="ml-1.5 font-mono text-base-content">{{ runStore.run.resume }}</strong>
          <span class="ml-1.5 rounded bg-base-300 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            {{ runStore.run.family }}
          </span>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-xs btn-primary gap-1.5 font-semibold"
        :disabled="busyAction !== null"
        @click="handleAction('resume', () => runStore.resumeTraining(), 'Resumed training run')"
      >
        <Play class="h-3.5 w-3.5" />
        <span>Resume Run</span>
      </button>
    </section>

    <!-- STATE 4: Completed Run Summary Card -->
    <section
      v-else-if="runStore.isCompleted && !sessionDismissed && runStore.run"
      class="rounded-xl border border-success/30 bg-success/5 p-4 shadow-xs space-y-3"
    >
      <!-- Top Row: Completed status badge, LoRA name, duration, and post-run CTAs -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b border-success/20 pb-3"
      >
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <span
            class="rounded bg-success/15 border border-success/30 px-2 py-0.5 text-xs font-semibold text-success flex items-center gap-1.5"
          >
            <CheckCircle2 class="h-3.5 w-3.5" />
            <span>Completed</span>
          </span>
          <span class="text-sm font-bold font-mono text-base-content truncate">
            {{ runStore.run.lora }}
          </span>
          <span class="badge badge-sm badge-neutral border-hairline font-mono text-[11px]">
            {{ runStore.run.family }}
          </span>
          <span v-if="completedDurationText" class="text-xs text-muted font-mono">
            Ran for <strong class="text-base-content">{{ completedDurationText }}</strong>
          </span>
        </div>

        <!-- Post-Run Action Buttons -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            class="btn btn-xs border border-hairline bg-base-200 hover:border-primary/50 text-xs gap-1"
            title="Load these settings into Composer to train further or adapt"
            @click="
              emit('clone', {
                lora: runStore.run.lora,
                family: runStore.run.family,
                image_folder: runStore.run.image_folder,
                values: runStore.run.values,
              })
            "
          >
            <Copy class="h-3.5 w-3.5 text-primary" />
            <span>Clone to Composer</span>
          </button>

          <button
            type="button"
            class="btn btn-xs border border-hairline bg-base-200 text-xs gap-1"
            title="View in History"
            @click="emit('view-history')"
          >
            <History class="h-3.5 w-3.5" />
            <span>History</span>
          </button>

          <button
            type="button"
            class="btn btn-xs btn-ghost border border-hairline bg-base-200 text-subtle hover:text-base-content"
            title="Dismiss completed summary and return to standby"
            @click="emit('dismiss')"
          >
            <X class="h-3.5 w-3.5" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>

      <!-- Bottom Row: Metrics & Output Artifact Path -->
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-3 font-mono text-[11px] text-muted flex-wrap">
          <span v-if="runStore.run.progress">
            Steps:
            <strong class="text-base-content"
              >{{ runStore.run.progress.step }} / {{ runStore.run.progress.total_steps }}</strong
            >
            ({{ runStore.run.progress.epoch }} epochs)
          </span>
          <span v-if="runStore.run.progress?.loss">
            · Final Loss: <strong class="text-primary">{{ runStore.run.progress.loss }}</strong>
          </span>
          <span v-if="runStore.run.image_folder">
            · Dataset: <strong class="text-base-content">{{ runStore.run.image_folder }}</strong>
          </span>
        </div>

        <!-- Artifact Path Copy Button -->
        <div
          v-if="completedArtifactPath"
          class="flex items-center gap-1.5 font-mono text-[11px] bg-base-200/80 border border-hairline rounded px-2 py-0.5 max-w-md truncate"
        >
          <span class="text-muted shrink-0">Artifact:</span>
          <span class="text-base-content truncate">{{ completedArtifactPath }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs h-5 min-h-0 px-1 hover:text-primary shrink-0 cursor-pointer"
            title="Copy artifact path"
            @click="copyPath(completedArtifactPath)"
          >
            <Copy class="h-3 w-3" />
          </button>
        </div>
      </div>
    </section>

    <!-- STATE 5: Trainer Standby / Idle Banner -->
    <section
      v-else
      class="rounded-xl border border-hairline bg-base-300 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-base-200 border border-hairline text-subtle"
        >
          <Sparkles class="h-4 w-4 text-primary" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-base-content">Trainer Standby</span>
            <span class="badge badge-sm badge-ghost border-hairline font-mono text-[10px]"
              >IDLE</span
            >
          </div>
          <p class="text-xs text-muted">No active training run. Hardware is ready for compute.</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <router-link
          to="/composer"
          class="btn btn-xs btn-primary gap-1 text-xs font-semibold shadow-xs"
        >
          <span>Launch Run in Composer</span>
          <ArrowRight class="h-3 w-3" />
        </router-link>

        <button
          type="button"
          class="btn btn-xs btn-ghost border border-hairline bg-base-200 text-xs gap-1"
          @click="emit('view-history')"
        >
          <History class="h-3.5 w-3.5" />
          <span>Browse History</span>
        </button>
      </div>
    </section>
  </div>
</template>
