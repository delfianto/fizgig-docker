import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  type CheckpointItem,
  type GpuStatsResponse,
  type HistoricalRun,
  type LiveRunResponse,
  type LossDataPoint,
  type RunLossResponse,
  type SampleItem,
  type SamplesResponse,
} from "@shared/types";
import { apiGet, apiPost } from "@/api/client";

export const useRunStore = defineStore("run", () => {
  const run = ref<LiveRunResponse | null>(null);
  const stats = ref<GpuStatsResponse | null>(null);
  const lossPoints = ref<LossDataPoint[]>([]);
  const samples = ref<SampleItem[]>([]);
  const samplePrompts = ref<string[]>([]);
  const sampleModeNote = ref<string>("");
  const checkpoints = ref<CheckpointItem[]>([]);
  const historicalRuns = ref<HistoricalRun[]>([]);
  const consoleLog = ref<string>("");
  const logBytePos = ref<number>(0);
  const lastError = ref<string | null>(null);

  const isRunning = computed(() => Boolean(run.value?.running));
  const isActiveOrStarting = computed(() => {
    const st = run.value?.state;
    return Boolean(run.value?.running || st === "starting" || st === "running" || st === "pausing");
  });
  const isCompleted = computed(() => {
    if (!run.value) return false;
    if (run.value.running) return false;
    const st = run.value.state;
    return (
      st === "completed" ||
      st === "finished" ||
      (run.value.progress?.percent ?? 0) >= 100 ||
      Boolean(run.value.ended_at && run.value.lora)
    );
  });

  const activeLoraName = computed(() => run.value?.lora || historicalRuns.value[0]?.lora || "");
  const activeOutputDir = computed(
    () => run.value?.output_dir || historicalRuns.value[0]?.output_dir || "/workspace/output_loras",
  );

  const lowestLossPoint = computed<LossDataPoint | null>(() => {
    if (lossPoints.value.length === 0) return null;
    let best = lossPoints.value[0] ?? null;
    for (const pt of lossPoints.value) {
      if (best === null || pt.loss < best.loss) {
        best = pt;
      }
    }
    return best;
  });

  async function pollRun(): Promise<void> {
    try {
      const data = await apiGet<LiveRunResponse>("/api/run");
      run.value = data;
      lastError.value = null;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : "Failed to poll /api/run";
    }
  }

  async function pollStats(): Promise<void> {
    try {
      stats.value = await apiGet<GpuStatsResponse>("/api/stats");
    } catch {
      // Ignore transient telemetry hiccups
    }
  }

  async function fetchLiveLoss(runId?: string): Promise<void> {
    try {
      const targetId =
        runId ||
        (!run.value?.running && historicalRuns.value[0]?.id
          ? historicalRuns.value[0].id
          : undefined);
      const res = await apiGet<RunLossResponse>(
        "/api/runs/loss",
        targetId ? { id: targetId } : { live: 1 },
      );
      const parsed: LossDataPoint[] = [];
      if (Array.isArray(res.points)) {
        for (const item of res.points) {
          if (Array.isArray(item)) {
            const [step, epoch, loss, lr] = item;
            if (typeof step === "number" && typeof loss === "number") {
              parsed.push({ step, loss, epoch, lr });
            }
          } else if (
            item &&
            typeof item === "object" &&
            typeof item.step === "number" &&
            typeof item.loss === "number"
          ) {
            parsed.push(item);
          }
        }
      } else if (Array.isArray(res.steps) && Array.isArray(res.losses)) {
        const len = Math.min(res.steps.length, res.losses.length);
        for (let i = 0; i < len; i++) {
          const step = res.steps[i];
          const loss = res.losses[i];
          if (typeof step === "number" && typeof loss === "number") {
            parsed.push({ step, loss, lr: res.lr?.[i] });
          }
        }
      }
      lossPoints.value = parsed;
    } catch {
      // Keep existing points
    }
  }

  async function fetchSamples(customDir?: string, customRun?: string): Promise<void> {
    const dir = customDir ?? `${activeOutputDir.value}/sample`;
    const runName = customRun ?? activeLoraName.value;
    if (!runName) return;
    try {
      const res = await apiGet<SamplesResponse>("/api/samples", {
        dir,
        run: runName,
      });
      samples.value = res.items ?? [];
      samplePrompts.value = res.prompts ?? [];
      sampleModeNote.value = res.mode ?? "";
    } catch {
      // Ignore if sample dir doesn't exist yet
    }
  }

  async function fetchCheckpoints(customDir?: string): Promise<void> {
    const dir = customDir ?? activeOutputDir.value;
    try {
      const res = await apiGet<{ items?: CheckpointItem[] }>("/api/checkpoints", { dir });
      const all = res.items ?? [];
      checkpoints.value = activeLoraName.value
        ? all.filter((item) => item.run === activeLoraName.value)
        : all;
    } catch {
      // Ignore
    }
  }

  async function fetchHistoricalRuns(): Promise<void> {
    try {
      const res = await apiGet<{ runs?: HistoricalRun[] }>("/api/runs");
      historicalRuns.value = res.runs ?? [];
    } catch {
      // Ignore
    }
  }

  let logSource: EventSource | null = null;

  function startLogStream(): void {
    if (logSource) return;
    try {
      logSource = new EventSource(`/api/log?since=${logBytePos.value}`);
      logSource.addEventListener("message", (event) => {
        try {
          const text = JSON.parse(event.data);
          if (typeof text === "string") {
            consoleLog.value = (consoleLog.value + text + "\n").slice(-120_000);
          }
          if (event.lastEventId) {
            logBytePos.value = Number(event.lastEventId);
          }
        } catch {
          // ignore
        }
      });
      logSource.addEventListener("error", () => {
        logSource?.close();
        logSource = null;
      });
    } catch {
      // ignore
    }
  }

  function stopLogStream(): void {
    if (logSource) {
      logSource.close();
      logSource = null;
    }
  }

  async function pollLog(): Promise<void> {
    startLogStream();
  }

  // Explicit Execution Controls
  async function triggerSampleNow(): Promise<void> {
    await apiPost("/api/run/now", { kind: "sample" });
    await pollRun();
  }

  async function triggerSaveNow(): Promise<void> {
    await apiPost("/api/run/now", { kind: "save" });
    await pollRun();
  }

  async function pauseTraining(): Promise<void> {
    await apiPost("/api/pause", {});
    await pollRun();
  }

  async function resumeTraining(): Promise<void> {
    await apiPost("/api/resume", {});
    await pollRun();
  }

  async function stopTraining(): Promise<void> {
    await apiPost("/api/stop", {});
    await pollRun();
  }

  // Safe, explicit Live Sample Override (never called from draft Composer!)
  async function applyLiveSampleOverride(payload: {
    on: boolean;
    prompts: string;
    seed: string | number;
    width: string | number;
    height: string | number;
    steps: string | number;
    cfg: string | number;
    turbo: string | number;
    every: string | number;
  }): Promise<{ ok: boolean; on: boolean }> {
    return apiPost<{ ok: boolean; on: boolean }>("/api/run/sample_override", payload);
  }

  // Queue Controls
  async function holdQueue(): Promise<void> {
    await apiPost("/api/queue/hold", {});
    await pollRun();
  }

  async function startQueue(): Promise<void> {
    await apiPost("/api/queue/start", {});
    await pollRun();
  }

  async function removeQueueItem(id: string): Promise<void> {
    await apiPost("/api/queue/remove", { id });
    await pollRun();
  }

  async function moveQueueItem(id: string, dir: -1 | 1): Promise<void> {
    await apiPost("/api/queue/move", { id, dir });
    await pollRun();
  }

  function clearSessionState(): void {
    stopLogStream();
    lossPoints.value = [];
    samples.value = [];
    samplePrompts.value = [];
    sampleModeNote.value = "";
    checkpoints.value = [];
    consoleLog.value = "";
    logBytePos.value = 0;
  }

  return {
    run,
    stats,
    lossPoints,
    samples,
    samplePrompts,
    sampleModeNote,
    checkpoints,
    historicalRuns,
    consoleLog,
    lastError,
    isRunning,
    isActiveOrStarting,
    isCompleted,
    activeLoraName,
    activeOutputDir,
    lowestLossPoint,
    pollRun,
    pollStats,
    fetchLiveLoss,
    fetchSamples,
    fetchCheckpoints,
    fetchHistoricalRuns,
    pollLog,
    startLogStream,
    stopLogStream,
    triggerSampleNow,
    triggerSaveNow,
    pauseTraining,
    resumeTraining,
    stopTraining,
    applyLiveSampleOverride,
    holdQueue,
    startQueue,
    removeQueueItem,
    moveQueueItem,
    clearSessionState,
  };
});
