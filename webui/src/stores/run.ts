import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  type CheckpointItem,
  type GpuStatsResponse,
  type HistoricalRun,
  type LiveRunResponse,
  type LossDataPoint,
  type SampleItem,
} from "@shared/types";
import { apiGet, apiPost } from "@/api/client";
import {
  parseCheckpointsResponse,
  parseHistoricalRunsResponse,
  parseLossResponse,
  parseSamplesResponse,
} from "@/api/schemas";

export const useRunStore = defineStore("run", () => {
  const run = ref<LiveRunResponse | null>(null);
  const stats = ref<GpuStatsResponse | null>(null);
  const lossPoints = ref<LossDataPoint[]>([]);
  const samples = ref<SampleItem[]>([]);
  const samplePrompts = ref<string[]>([]);
  const sampleModeNote = ref<string>("");
  const checkpoints = ref<CheckpointItem[]>([]);
  const allCheckpoints = ref<CheckpointItem[]>([]);
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

  const hasLiveSession = computed(
    () => isActiveOrStarting.value || Boolean(run.value?.resume) || isCompleted.value,
  );

  const activeLoraName = computed(() => (hasLiveSession.value ? run.value?.lora || "" : ""));
  const activeOutputDir = computed(
    () =>
      (hasLiveSession.value ? run.value?.output_dir : "") ||
      historicalRuns.value[0]?.output_dir ||
      "/workspace/output_loras",
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
    if (!runId && !hasLiveSession.value) {
      lossPoints.value = [];
      return;
    }
    try {
      const targetId =
        runId || (!run.value?.running && run.value?.history_id ? run.value.history_id : undefined);
      const res = await apiGet<unknown>(
        "/api/runs/loss",
        targetId ? { id: targetId } : { live: 1 },
      );
      lossPoints.value = parseLossResponse(res);
    } catch {
      // Keep existing points
    }
  }

  async function fetchSamples(customDir?: string, customRun?: string): Promise<void> {
    const runName = customRun ?? activeLoraName.value;
    if (!runName) {
      samples.value = [];
      samplePrompts.value = [];
      sampleModeNote.value = "";
      return;
    }
    const dir = customDir ?? `${activeOutputDir.value}/sample`;
    try {
      const res = await apiGet<unknown>("/api/samples", {
        dir,
        run: runName,
      });
      const parsed = parseSamplesResponse(res);
      samples.value = parsed.items;
      samplePrompts.value = parsed.prompts ?? [];
      sampleModeNote.value = parsed.mode ?? "";
    } catch {
      // Ignore if sample dir doesn't exist yet
    }
  }

  async function fetchCheckpoints(customDir?: string, targetRunName?: string): Promise<void> {
    const dir = customDir ?? activeOutputDir.value;
    try {
      const res = await apiGet<unknown>("/api/checkpoints", { dir });
      const all = parseCheckpointsResponse(res);
      allCheckpoints.value = all;
      const filterRun = targetRunName !== undefined ? targetRunName : activeLoraName.value;
      checkpoints.value = filterRun ? all.filter((item) => item.run === filterRun) : [];
    } catch {
      // Ignore
    }
  }

  async function fetchHistoricalRuns(): Promise<void> {
    try {
      const res = await apiGet<unknown>("/api/runs");
      historicalRuns.value = parseHistoricalRunsResponse(res);
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
    allCheckpoints,
    historicalRuns,
    consoleLog,
    lastError,
    isRunning,
    isActiveOrStarting,
    isCompleted,
    hasLiveSession,
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
