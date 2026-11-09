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
});
