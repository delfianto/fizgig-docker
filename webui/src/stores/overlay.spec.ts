import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePlanOverlayStore } from "./overlay";

describe("usePlanOverlayStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("initializes hidden", () => {
    const store = usePlanOverlayStore();
    expect(store.visible).toBe(false);
    expect(store.problems).toEqual([]);
    expect(store.warnings).toEqual([]);
  });

  it("shows success status and payload", () => {
    const store = usePlanOverlayStore();
    store.show({
      status: "success",
      title: "Plan Validated Cleanly",
      message: "Ready to train",
      duration: 5000,
    });

    expect(store.visible).toBe(true);
    expect(store.status).toBe("success");
    expect(store.title).toBe("Plan Validated Cleanly");
    expect(store.message).toBe("Ready to train");
    expect(store.problems).toHaveLength(0);
  });

  it("shows attention status with problems and warnings", () => {
    const store = usePlanOverlayStore();
    store.show({
      status: "attention",
      title: "Plan Blockers Detected",
      problems: ["VRAM exceeds limit", "Dataset path not found"],
      warnings: ["High learning rate"],
      duration: 8000,
    });

    expect(store.visible).toBe(true);
    expect(store.status).toBe("attention");
    expect(store.problems).toEqual(["VRAM exceeds limit", "Dataset path not found"]);
    expect(store.warnings).toEqual(["High learning rate"]);
  });

  it("dismisses cleanly", () => {
    const store = usePlanOverlayStore();
    store.show({ status: "success", title: "Test" });
    expect(store.visible).toBe(true);

    store.dismiss();
    expect(store.visible).toBe(false);
  });

  it("tracks pause/resume state and increments seq on repeated alerts", () => {
    const store = usePlanOverlayStore();
    store.show({ status: "success", title: "First", duration: 5000 });
    const firstSeq = store.seq;
    expect(store.paused).toBe(false);

    store.pauseTimer();
    expect(store.paused).toBe(true);

    store.resumeTimer();
    expect(store.paused).toBe(false);

    store.show({ status: "warning", title: "Second", duration: 5000 });
    expect(store.seq).toBe(firstSeq + 1);
  });
});
