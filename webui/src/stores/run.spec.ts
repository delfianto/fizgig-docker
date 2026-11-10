import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useRunStore } from "./run";

describe("useRunStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("initializes with clean default state", () => {
    const store = useRunStore();
    expect(store.run).toBeNull();
    expect(store.lossPoints).toEqual([]);
    expect(store.isRunning).toBe(false);
    expect(store.isActiveOrStarting).toBe(false);
    expect(store.lowestLossPoint).toBeNull();
  });

  it("correctly computes lowestLossPoint across loss series", () => {
    const store = useRunStore();
    store.lossPoints = [
      { step: 10, epoch: 1, loss: 0.125, lr: 0.0001 },
      { step: 20, epoch: 1, loss: 0.042, lr: 0.0001 },
      { step: 30, epoch: 2, loss: 0.089, lr: 0.0001 },
      { step: 40, epoch: 2, loss: 0.021, lr: 0.0001 },
      { step: 50, epoch: 3, loss: 0.035, lr: 0.0001 },
    ];

    expect(store.lowestLossPoint).toEqual({
      step: 40,
      epoch: 2,
      loss: 0.021,
      lr: 0.0001,
    });
  });

  it("identifies active and starting states correctly", () => {
    const store = useRunStore();
    expect(store.isActiveOrStarting).toBe(false);

    store.run = {
      running: false,
      state: "starting",
      stage: "init",
      lora: "test_lora",
      history_id: "run_123",
      output_dir: "/workspace/output",
      family: "krea2",
      values: {},
      image_folder: "/workspace/dataset",
      pause: false,
      resume: "",
      resume_mode: "off",
      progress: null,
      started_at: null,
      training_at: null,
      web_queue: { items: [], held: false, reason: "", waiting: "" },
    };
    expect(store.isActiveOrStarting).toBe(true);

    store.run = {
      ...store.run,
      running: true,
      state: "running",
    };
    expect(store.isActiveOrStarting).toBe(true);
    expect(store.isRunning).toBe(true);
  });

  it("clears session state cleanly upon dismiss", () => {
    const store = useRunStore();
    store.lossPoints = [{ step: 10, loss: 0.2 }];
    store.samples = [{ epoch: 1, prompt_index: 0, path: "/sample.png", name: "s1" }];
    store.samplePrompts = ["a prompt"];
    store.sampleModeNote = "note";
    store.checkpoints = [
      {
        name: "ep1.safetensors",
        path: "/path",
        run: "my_run",
        size: 1000,
        mtime: 12345,
        epoch: 1,
      },
    ];
    store.consoleLog = "training log line";

    store.clearSessionState();

    expect(store.lossPoints).toEqual([]);
    expect(store.samples).toEqual([]);
    expect(store.samplePrompts).toEqual([]);
    expect(store.sampleModeNote).toBe("");
    expect(store.checkpoints).toEqual([]);
    expect(store.consoleLog).toBe("");
  });

  it("does not leak historicalRuns[0] into activeLoraName when trainer is idle", () => {
    const store = useRunStore();
    store.historicalRuns = [
      {
        id: "hist_1",
        lora: "archived_lora_v1",
        family: "krea2",
        image_folder: "/datasets/a",
        output_dir: "/workspace/output_loras",
        started_at: 1700000000,
        values: {},
      },
    ];
    store.run = {
      running: false,
      state: "idle",
      stage: "",
      lora: "",
      history_id: "",
      output_dir: "",
      family: "",
      values: {},
      image_folder: "",
      pause: false,
      resume: "",
      resume_mode: "off",
      progress: null,
      started_at: null,
      training_at: null,
      web_queue: { items: [], held: false, reason: "", waiting: "" },
    };

    expect(store.hasLiveSession).toBe(false);
    expect(store.activeLoraName).toBe("");
  });
});
