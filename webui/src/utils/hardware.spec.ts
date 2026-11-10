import { describe, expect, it } from "vitest";
import {
  bytesToGb,
  cleanGpuName,
  estimateVramGb,
  evaluateVramHeadroom,
  gpuVramPercent,
  resolveAvailableGpus,
} from "./hardware";

describe("hardware utilities", () => {
  it("cleans NVIDIA GeForce prefixes cleanly", () => {
    expect(cleanGpuName("NVIDIA GeForce RTX 4080")).toBe("RTX 4080");
    expect(cleanGpuName("NVIDIA A100-SXM4-80GB")).toBe("A100-SXM4-80GB");
    expect(cleanGpuName("")).toBe("GPU");
    expect(cleanGpuName(undefined)).toBe("GPU");
  });

  it("converts bytes and percentages safely", () => {
    expect(bytesToGb(16 * 1024 * 1024 * 1024)).toBe(16);
    expect(bytesToGb(0)).toBe(0);
    expect(gpuVramPercent(4, 16)).toBe(25);
    expect(gpuVramPercent(0, 0)).toBe(0);
  });

  it("resolves multi-GPU telemetry from stats and fallbacks", () => {
    const gpus = resolveAvailableGpus({
      vram: [2 * 1073741824, 16 * 1073741824],
      ram: [8 * 1073741824, 32 * 1073741824],
      vram_peak: 0,
      ram_peak: 0,
      device_name: "NVIDIA GeForce RTX 4080",
      disk: { used: 0, total: 100, free: 100, where: "/", path: "/workspace" },
      jobs: [],
      loaded: [],
      gpus: [
        {
          index: 0,
          name: "NVIDIA GeForce RTX 4080",
          vram: [1073741824, 16 * 1073741824],
          util: 10,
          temp: 45,
        },
        {
          index: 1,
          name: "NVIDIA GeForce RTX 3060",
          vram: [2 * 1073741824, 12 * 1073741824],
          util: 5,
          temp: 50,
        },
      ],
    });
    expect(gpus).toHaveLength(2);
    expect(gpus[0]?.name).toBe("RTX 4080");
    expect(gpus[0]?.vramFreeGb).toBe(15);
    expect(gpus[1]?.name).toBe("RTX 3060");
    expect(gpus[1]?.vramTotalGb).toBe(12);
  });

  it("estimates VRAM across model families and evaluates OOM headroom", () => {
    expect(
      estimateVramGb("krea2", { DATASET_MEGAPIXELS: 1.0, NETWORK_DIM: 16, BATCH_SIZE: 1 }),
    ).toBe(11.5);
    expect(
      estimateVramGb("klein", { DATASET_MEGAPIXELS: 0.25, NETWORK_DIM: 16, BATCH_SIZE: 1 }),
    ).toBe(11.2);
    expect(
      estimateVramGb("flux", { DATASET_MEGAPIXELS: 1.0, NETWORK_DIM: 64, BATCH_SIZE: 2 }),
    ).toBe(21.1);

    const safe = evaluateVramHeadroom({ vramTotalGb: 16, vramFreeGb: 15.5 }, 11.5);
    expect(safe.ok).toBe(true);
    expect(safe.headroomGb).toBe(3.7);

    const oom = evaluateVramHeadroom({ vramTotalGb: 12, vramFreeGb: 9.5 }, 11.5);
    expect(oom.ok).toBe(false);
    expect(oom.isSevereOom).toBe(true);
    expect(oom.headroomGb).toBe(-2);
  });
});
