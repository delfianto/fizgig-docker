import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { isValueEqual, useComposerStore } from "./composer";
import { useSchemaStore } from "./schema";

describe("isValueEqual", () => {
  it("compares scientific notation and numeric strings accurately", () => {
    expect(isValueEqual("1e-4", 0.0001)).toBe(true);
    expect(isValueEqual("30", 30)).toBe(true);
    expect(isValueEqual("1.0", 1)).toBe(true);
    expect(isValueEqual("0.0001", "0.0002")).toBe(false);
  });

  it("compares booleans without conflating numbers like 1 or 0", () => {
    expect(isValueEqual(true, "true")).toBe(true);
    expect(isValueEqual(false, "false")).toBe(true);
    expect(isValueEqual(true, 1)).toBe(false);
    expect(isValueEqual(false, 0)).toBe(false);
  });

  it("compares dictionaries regardless of key insertion order", () => {
    expect(
      isValueEqual({ double_0: true, single_1: false }, { single_1: false, double_0: true }),
    ).toBe(true);
    expect(isValueEqual({ double_0: true }, { double_0: false })).toBe(false);
  });
});

describe("useComposerStore dataset & modified tracking", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("initializes without hardcoded personal dataset paths", () => {
    const store = useComposerStore();
    expect(store.imageFolder).toBe("");
    expect(store.family).toBe("");
  });

  it("auto-selects the first completely tagged dataset when ensureValidDatasetSelected runs", () => {
    const schemaStore = useSchemaStore();
    schemaStore.datasets = [
      { name: "incomplete_ds", path: "/datasets/incomplete_ds", count: 20, captioned: 5 },
      { name: "ready_ds", path: "/datasets/ready_ds", count: 50, captioned: 50 },
    ];
    const composerStore = useComposerStore();
    composerStore.family = "krea2";
    composerStore.ensureValidDatasetSelected();

    expect(composerStore.imageFolder).toBe("/datasets/ready_ds");
    expect(composerStore.draftValues.LORA_NAME).toBe("ready_ds_krea2_v1");
  });
});
