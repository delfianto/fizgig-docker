<script setup lang="ts">
import { computed, ref } from "vue";
import { Camera, Pause, Play, Save, Square } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useRunStore } from "@/stores/run";

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
    <!-- Live Run Status & Instant Controls Card -->
    <section
      v-if="runStore.isActiveOrStarting && runStore.run"
      class="rounded-xl border border-hairline bg-base-300 p-4 shadow-xs space-y-3"
    >
      <!-- Top Row: Stage & Run Identity on Left, Instant Controls on Right -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
            />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>

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

    <!-- Paused Resume Banner (when trainer is idle but has a resumable run) -->
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
  </div>
</template>
