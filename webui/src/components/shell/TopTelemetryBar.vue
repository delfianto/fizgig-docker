<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Camera, Cpu, HardDrive, Pause, Play, Save, Square } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { formatBytes } from "@/api/client";
import { useRunStore } from "@/stores/run";
import { useSystemStore } from "@/stores/system";

const router = useRouter();
const runStore = useRunStore();
const systemStore = useSystemStore();
const confirmStop = ref(false);
const busyAction = ref<string | null>(null);

const progress = computed(() => runStore.run?.progress ?? null);

const vramPercent = computed(() => {
  const v = runStore.stats?.vram;
  if (!v || !v[1]) return 0;
  return Math.min(100, Math.round((v[0] / v[1]) * 100));
});

const ramPercent = computed(() => {
  const r = runStore.stats?.ram;
  if (!r || !r[1]) return 0;
  return Math.min(100, Math.round((r[0] / r[1]) * 100));
});

const sparklinePath = computed(() => {
  const pts = runStore.lossPoints.slice(-60);
  if (pts.length < 2) return "";
  const losses = pts.map((p) => p.loss);
  const min = Math.min(...losses);
  const max = Math.max(...losses);
  const span = Math.max(1e-6, max - min);
  const w = 68;
  const h = 18;
  return pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((p.loss - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
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
  <header
    class="flex h-11 shrink-0 items-center justify-between border-b border-hairline bg-base-200 px-3.5 text-xs select-none"
  >
    <!-- Left Cluster: Live Run Ticker & Instant Controls -->
    <div class="flex items-center gap-3 overflow-hidden">
      <template v-if="runStore.isActiveOrStarting && runStore.run">
        <button
          type="button"
          class="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-left transition hover:border-warning/60"
          @click="router.push('/cockpit')"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"
            />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-warning" />
          </span>
          <span class="font-semibold text-warning">
            {{ runStore.run.pause ? "Pausing at Epoch" : runStore.run.stage || "Training" }}
          </span>
          <span class="font-mono-num font-semibold text-base-content">
            {{ runStore.run.lora }}
          </span>
          <span class="rounded bg-base-300 px-1.5 py-0.5 font-mono text-[11px] text-subtle">
            {{ runStore.run.family }}
          </span>
        </button>

        <div v-if="progress" class="font-mono-num flex items-center gap-3 text-xs text-subtle">
          <span>
            Ep
            <strong class="text-base-content">
              {{ progress.epoch }}/{{ progress.total_epochs }}
            </strong>
          </span>
          <span class="text-muted">·</span>
          <span>
            Step
            <strong class="text-base-content">
              {{ progress.step }}/{{ progress.total_steps }}
            </strong>
            <span class="ml-1 text-muted"> ({{ progress.percent.toFixed(1) }}%) </span>
          </span>
          <span class="text-muted">·</span>
          <span>
            Loss
            <strong class="text-primary">{{ progress.loss }}</strong>
          </span>
          <span class="hidden text-muted xl:inline">·</span>
          <span class="hidden xl:inline">{{ progress.speed }}</span>
          <span class="text-muted">·</span>
          <span>
            ETA <strong class="text-base-content">{{ progress.eta }}</strong>
          </span>
        </div>

        <!-- Mini SVG Loss Sparkline -->
        <svg
          v-if="sparklinePath"
          width="70"
          height="20"
          class="hidden shrink-0 rounded border border-hairline bg-base-100 px-0.5 lg:block"
        >
          <path :d="sparklinePath" fill="none" stroke="var(--color-primary)" stroke-width="1.5" />
        </svg>

        <!-- Quick Run Controls -->
        <div class="flex items-center gap-1 border-l border-hairline pl-2.5">
          <button
            type="button"
            class="btn btn-xs btn-ghost border border-hairline bg-base-300 hover:border-hairline-strong"
            :disabled="busyAction !== null"
            title="Render sample previews after the current step"
            @click="
              handleAction(
                'sample',
                () => runStore.triggerSampleNow(),
                'Requested preview sample after current step',
              )
            "
          >
            <Camera class="h-3.5 w-3.5 text-primary" />
            <span class="hidden md:inline">Sample Now</span>
          </button>

          <button
            type="button"
            class="btn btn-xs btn-ghost border border-hairline bg-base-300 hover:border-hairline-strong"
            :disabled="busyAction !== null"
            title="Save a checkpoint after the current step"
            @click="
              handleAction(
                'save',
                () => runStore.triggerSaveNow(),
                'Requested checkpoint save after current step',
              )
            "
          >
            <Save class="h-3.5 w-3.5 text-success" />
            <span class="hidden md:inline">Save Now</span>
          </button>

          <button
            type="button"
            class="btn btn-xs btn-ghost border border-hairline bg-base-300 hover:border-warning/50"
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
            <span class="hidden md:inline">
              {{ runStore.run.pause ? "Pausing…" : "Pause" }}
            </span>
          </button>

          <!-- Two-step Stop Guard -->
          <div class="relative flex items-center">
            <button
              v-if="!confirmStop"
              type="button"
              class="btn btn-xs btn-ghost border border-error/30 bg-error/10 text-error hover:bg-error/20"
              title="Stop active training run"
              @click="confirmStop = true"
            >
              <Square class="h-3 w-3" />
              <span class="hidden md:inline">Stop</span>
            </button>
            <div
              v-else
              class="flex items-center gap-1 rounded border border-error/50 bg-base-300 px-1.5 py-0.5"
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
      </template>

      <template v-else>
        <div class="flex items-center gap-2.5 text-subtle">
          <span
            class="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-base-300 px-2.5 py-1 text-xs"
          >
            <span class="h-2 w-2 rounded-full bg-muted" />
            <span>Trainer Idle</span>
          </span>

          <button
            v-if="runStore.run?.resume"
            type="button"
            class="btn btn-xs btn-primary"
            @click="handleAction('resume', () => runStore.resumeTraining(), 'Resumed training run')"
          >
            <Play class="h-3 w-3" />
            Resume ({{ runStore.run.resume }})
          </button>

          <span class="text-muted">
            Queue:
            <strong class="font-mono-num text-base-content">
              {{ runStore.run?.web_queue?.items?.length ?? 0 }}
            </strong>
            pending
            <span v-if="runStore.run?.web_queue?.held" class="text-warning"> (Held) </span>
          </span>
        </div>
      </template>
    </div>

    <!-- Right Cluster: GPU VRAM, System RAM & Disk Telemetry + Font Scale -->
    <div class="font-mono-num flex shrink-0 items-center gap-3 text-xs text-subtle">
      <div
        v-if="runStore.stats"
        class="flex items-center gap-2"
        :title="runStore.stats.device_name"
      >
        <Cpu class="h-4 w-4 text-primary" />
        <span class="hidden font-sans font-medium text-base-content 2xl:inline">
          {{ runStore.stats.device_name.replace("NVIDIA GeForce ", "") }}
        </span>
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-muted">VRAM</span>
            <span class="font-semibold text-base-content">
              {{ formatBytes(runStore.stats.vram[0]) }} /
              {{ formatBytes(runStore.stats.vram[1]) }}
            </span>
          </div>
          <div class="h-1.5 w-24 overflow-hidden rounded-full bg-base-100">
            <div
              class="h-full transition-all duration-300"
              :class="vramPercent > 92 ? 'bg-warning' : 'bg-primary'"
              :style="{ width: `${vramPercent}%` }"
            />
          </div>
        </div>
      </div>

      <div v-if="runStore.stats" class="hidden flex-col gap-0.5 sm:flex">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] text-muted">RAM</span>
          <span>
            {{ formatBytes(runStore.stats.ram[0]) }} /
            {{ formatBytes(runStore.stats.ram[1]) }}
          </span>
        </div>
        <div class="h-1.5 w-20 overflow-hidden rounded-full bg-base-100">
          <div
            class="h-full bg-info transition-all duration-300"
            :style="{ width: `${ramPercent}%` }"
          />
        </div>
      </div>

      <div
        v-if="runStore.stats?.disk"
        class="hidden items-center gap-1.5 rounded border border-hairline bg-base-300 px-2 py-1 xl:flex"
        :title="`Output path: ${runStore.stats.disk.path}`"
      >
        <HardDrive class="h-3.5 w-3.5 text-muted" />
        <span>{{ formatBytes(runStore.stats.disk.free) }} free</span>
      </div>

      <!-- Quick Font Size Switcher -->
      <button
        type="button"
        class="btn btn-xs border border-hairline bg-base-300 px-2.5 py-1 text-xs text-subtle hover:border-primary/50"
        :title="`Font size: ${systemStore.fontScale}. Click to cycle (Normal → Large → Extra Large)`"
        @click="systemStore.cycleFontScale()"
      >
        <span class="font-bold text-base-content">A</span>
        <span
          class="rounded bg-primary/20 px-1 font-mono text-[10px] font-bold text-primary uppercase"
        >
          {{
            systemStore.fontScale === "xlarge"
              ? "XL"
              : systemStore.fontScale === "large"
                ? "L"
                : "M"
          }}
        </span>
      </button>
    </div>
  </header>
</template>
