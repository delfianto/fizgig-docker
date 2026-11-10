import { describe, expect, it } from "vitest";
import {
  extractEpochFromFilename,
  parseCheckpointsResponse,
  parseDatasetsResponse,
  parseLossResponse,
} from "./schemas";

describe("API Zod normalization schemas", () => {
  it("normalizes datasets with pictures fallback", () => {
    const datasets = parseDatasetsResponse({
      datasets: [
        { name: "kang-inkyung", path: "/datasets/kang-inkyung", pictures: 580, captioned: 580 },
      ],
    });
    expect(datasets).toHaveLength(1);
    expect(datasets[0]?.count).toBe(580);
    expect(datasets[0]?.captioned).toBe(580);
  });

  it("extracts checkpoint epoch numbers from safetensors filenames when omitted", () => {
    expect(extractEpochFromFilename("my_lora_krea2-000030.safetensors")).toBe(30);
    expect(extractEpochFromFilename("my_lora_ep12.safetensors")).toBe(12);
    expect(extractEpochFromFilename("final_model.safetensors")).toBeUndefined();

    const ckpts = parseCheckpointsResponse({
      items: [
        {
          name: "my_lora_krea2-000030.safetensors",
          path: "/workspace/output_loras/my_lora_krea2-000030.safetensors",
          run: "my_lora_krea2",
          size: 58791936,
          mtime: 1700000000,
        },
      ],
    });
    expect(ckpts[0]?.epoch).toBe(30);
  });

  it("parses tuple and object loss series", () => {
    const fromTuples = parseLossResponse({
      points: [
        [10, 1, 0.085, 0.0001],
        [20, 2, 0.042, 0.0001],
      ],
    });
    expect(fromTuples).toEqual([
      { step: 10, epoch: 1, loss: 0.085, lr: 0.0001 },
      { step: 20, epoch: 2, loss: 0.042, lr: 0.0001 },
    ]);

    const fromParallel = parseLossResponse({
      steps: [5, 10],
      losses: [0.12, 0.09],
      lr: [0.0002, 0.0001],
    });
    expect(fromParallel).toEqual([
      { step: 5, loss: 0.12, lr: 0.0002 },
      { step: 10, loss: 0.09, lr: 0.0001 },
    ]);
  });
});
