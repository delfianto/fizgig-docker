import { type GpuStatsResponse } from "@shared/types";

const BYTES_PER_GB = 1024 * 1024 * 1024;
const SYSTEM_VRAM_RESERVE_GB = 0.8;

export interface NormalizedGpuOption {
  index: number;
  name: string;
  vramUsedBytes: number;
  vramTotalBytes: number;
  vramFreeBytes: number;
  vramUsedGb: number;
  vramTotalGb: number;
  vramFreeGb: number;
  util: number;
  temp: number;
  power?: number;
  powerLimit?: number;
}

export interface VramHeadroomStatus {
  ok: boolean;
  headroomGb: number;
  isOomRisk: boolean;
  isSevereOom: boolean;
}

export function cleanGpuName(raw: string | undefined | null): string {
  if (!raw) return "GPU";
  const cleaned = raw
    .replace(/^NVIDIA\s+/i, "")
    .replace(/^GeForce\s+/i, "")
    .trim();
  return cleaned || "GPU";
}

export function bytesToGb(bytes: number, decimals = 1): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  const factor = 10 ** decimals;
  return Math.round((bytes / BYTES_PER_GB) * factor) / factor;
}

export function gpuVramPercent(usedBytes: number, totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((usedBytes / totalBytes) * 100)));
}

export function resolveAvailableGpus(
  stats: GpuStatsResponse | null | undefined,
  prefs?: Record<string, unknown>,
): NormalizedGpuOption[] {
  if (Array.isArray(stats?.gpus) && stats.gpus.length > 0) {
    return stats.gpus.map((g) => {
      const used = Math.max(0, g.vram[0] || 0);
      const total = Math.max(1, g.vram[1] || 1);
      const free = Math.max(0, total - used);
      return {
        index: g.index,
        name: cleanGpuName(g.name),
        vramUsedBytes: used,
        vramTotalBytes: total,
        vramFreeBytes: free,
        vramUsedGb: bytesToGb(used, 1),
        vramTotalGb: Math.round(total / BYTES_PER_GB),
        vramFreeGb: bytesToGb(free, 1),
        util: g.util ?? 0,
        temp: g.temp ?? 0,
        power: g.power,
        powerLimit: g.power_limit,
      };
    });
  }

  const prefGpus = prefs?.gpus;
  if (Array.isArray(prefGpus) && prefGpus.length > 0) {
    return prefGpus.map((rawGpu, idx) => {
      const g = rawGpu as {
        index?: number;
        name?: string;
        total_gb?: number;
        used_gb?: number;
      };
      const totalGb = g.total_gb && g.total_gb > 0 ? g.total_gb : 16;
      const usedGb = Math.max(0, g.used_gb || 0);
      const total = totalGb * BYTES_PER_GB;
      const used = usedGb * BYTES_PER_GB;
      const free = Math.max(0, total - used);
      return {
        index: g.index ?? idx,
        name: cleanGpuName(g.name) || `GPU ${g.index ?? idx}`,
        vramUsedBytes: used,
        vramTotalBytes: total,
        vramFreeBytes: free,
        vramUsedGb: Math.round(usedGb * 10) / 10,
        vramTotalGb: Math.round(totalGb),
        vramFreeGb: Math.round(Math.max(0, totalGb - usedGb) * 10) / 10,
        util: 0,
        temp: 0,
      };
    });
  }

  if (stats?.vram && stats.vram[1] > 0) {
    const used = Math.max(0, stats.vram[0] || 0);
    const total = Math.max(1, stats.vram[1]);
    const free = Math.max(0, total - used);
    return [
      {
        index: 0,
        name: cleanGpuName(stats.device_name) || "GPU 0",
        vramUsedBytes: used,
        vramTotalBytes: total,
        vramFreeBytes: free,
        vramUsedGb: bytesToGb(used, 1),
        vramTotalGb: Math.round(total / BYTES_PER_GB),
        vramFreeGb: bytesToGb(free, 1),
        util: stats.gpu_util ?? 0,
        temp: stats.gpu_temp ?? 0,
      },
    ];
  }

  return [];
}

export function estimateVramGb(familyKey: string, draftValues: Record<string, unknown>): number {
  const fam = familyKey.toLowerCase();
  let base = 12.0;

  if (fam.includes("krea2")) {
    base = 11.5;
  } else if (fam.includes("klein") || fam.includes("fibo")) {
    base = 12.0;
  } else if (fam.includes("zimage")) {
    base = 11.0;
  } else if (fam.includes("anima")) {
    base = 14.5;
  } else if (fam.includes("flux")) {
    base = 17.5;
  } else if (fam.includes("moss") || fam.includes("minimax") || fam.includes("qwen")) {
    base = 20.0;
  } else if (
    fam.includes("chroma") ||
    fam.includes("sdxl") ||
    fam.includes("pony") ||
    fam.includes("illustrious")
  ) {
    base = 9.5;
  } else if (fam.includes("lumina") || fam.includes("auraflow")) {
    base = 13.5;
  } else if (fam.includes("hunyuan")) {
    base = 17.5;
  } else if (fam.includes("wan")) {
    base = 15.5;
  }

  const mp = Number(draftValues.DATASET_MEGAPIXELS ?? 1.0);
  if (!Number.isNaN(mp)) {
    if (mp > 1.0) {
      base += (mp - 1.0) * 1.5;
    } else if (mp < 0.5) {
      base -= 0.8;
    }
  }

  const dim = Number(draftValues.NETWORK_DIM ?? 16);
  if (!Number.isNaN(dim)) {
    if (dim >= 64) {
      base += 1.6;
    } else if (dim > 32) {
      base += 0.8;
    } else if (dim <= 8) {
      base -= 0.5;
    }
  }

  const batch = Number(draftValues.BATCH_SIZE ?? 1);
  if (!Number.isNaN(batch) && batch > 1) {
    base += (batch - 1) * 2.0;
  }

  return Math.round(Math.max(4.0, base) * 10) / 10;
}

export function evaluateVramHeadroom(
  gpu: Pick<NormalizedGpuOption, "vramTotalGb" | "vramFreeGb"> | null | undefined,
  requiredGb: number,
): VramHeadroomStatus {
  if (!gpu) {
    return {
      ok: true,
      headroomGb: 4.0,
      isOomRisk: false,
      isSevereOom: false,
    };
  }

  const usableTotal = Math.max(0, gpu.vramTotalGb - SYSTEM_VRAM_RESERVE_GB);
  const headroomVsTotal = Math.round((usableTotal - requiredGb) * 10) / 10;
  const headroomVsFree = Math.round((gpu.vramFreeGb - requiredGb) * 10) / 10;

  const isSevereOom = requiredGb > usableTotal;
  const isOomRisk = requiredGb > gpu.vramFreeGb || isSevereOom;

  return {
    ok: !isOomRisk,
    headroomGb: isOomRisk ? headroomVsFree : headroomVsTotal,
    isOomRisk,
    isSevereOom,
  };
}
