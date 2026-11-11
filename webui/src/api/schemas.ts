import { z } from "zod";
import {
  type CaptionEntry,
  type CheckpointItem,
  type DatasetSummary,
  type HistoricalRun,
  type LossDataPoint,
  type SampleItem,
  type SamplesResponse,
} from "@shared/types";

const DatasetItemSchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  count: z.number().optional(),
  pictures: z.number().optional(),
  captioned: z.number().optional(),
  mtime: z.number().optional(),
  time: z.number().optional(),
  size: z.number().optional(),
  media: z.string().optional(),
  thumbs: z.array(z.string()).optional(),
});

const DatasetsEnvelopeSchema = z.object({
  datasets: z.array(DatasetItemSchema).optional().default([]),
});

export function parseDatasetsResponse(raw: unknown): DatasetSummary[] {
  const parsed = DatasetsEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.datasets.map((d) => ({
    name: d.name,
    path: d.path,
    count: d.count ?? d.pictures ?? 0,
    pictures: d.pictures ?? d.count ?? 0,
    captioned: d.captioned ?? 0,
    mtime: d.mtime ?? d.time,
    size: d.size,
    media: d.media,
    thumbs: d.thumbs,
  }));
}

/**
 * Extracts trailing epoch numbers from checkpoint filenames when upstream omits `.epoch`
 * (e.g. `my_lora_krea2-000030.safetensors` -> `30`, `lora_ep12.safetensors` -> `12`).
 */
export function extractEpochFromFilename(filename: string): number | undefined {
  const base = filename.replace(/\.safetensors$/i, "");
  const explicitMatch = base.match(/(?:^|[_-])(?:ep|epoch)[_-]?(\d+)$/i);
  if (explicitMatch?.[1]) {
    const val = Number.parseInt(explicitMatch[1], 10);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  const suffixMatch = base.match(/[-_](\d{4,6})$/);
  if (suffixMatch?.[1]) {
    const val = Number.parseInt(suffixMatch[1], 10);
    if (Number.isFinite(val) && val >= 0) return val;
  }
  return undefined;
}

const CheckpointItemSchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  run: z.string().optional().default(""),
  size: z.number().optional().default(0),
  mtime: z.number().optional().default(0),
  epoch: z.number().nullable().optional(),
});

const CheckpointsEnvelopeSchema = z.object({
  items: z.array(CheckpointItemSchema).optional().default([]),
});

export function parseCheckpointsResponse(raw: unknown): CheckpointItem[] {
  const parsed = CheckpointsEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.items.map((item) => ({
    name: item.name,
    path: item.path,
    run: item.run,
    size: item.size,
    mtime: item.mtime,
    epoch: item.epoch ?? extractEpochFromFilename(item.name),
  }));
}

const SampleItemSchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  epoch: z.number().optional().default(0),
  prompt_index: z.number().optional(),
  idx: z.number().optional(),
  prompt: z.string().optional(),
  seed: z.union([z.number(), z.string()]).optional(),
  mtime: z.number().optional(),
  time: z.number().optional(),
  likeness: z.number().nullable().optional(),
  style: z.number().nullable().optional(),
});

const SamplesEnvelopeSchema = z.object({
  items: z.array(SampleItemSchema).optional().default([]),
  prompts: z.array(z.string()).optional().default([]),
  mode: z.string().optional().default(""),
  turbo: z.boolean().optional(),
  style_on: z.boolean().optional(),
  likeness_refs: z.array(z.string()).optional(),
});

export function parseSamplesResponse(raw: unknown): SamplesResponse {
  const parsed = SamplesEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { items: [], prompts: [], mode: "" };
  }
  const items: SampleItem[] = parsed.data.items.map((it) => ({
    name: it.name,
    path: it.path,
    epoch: it.epoch,
    prompt_index: it.prompt_index ?? it.idx ?? 0,
    idx: it.idx ?? it.prompt_index ?? 0,
    prompt: it.prompt,
    seed: it.seed,
    mtime: it.mtime ?? it.time,
    time: it.time ?? it.mtime,
    likeness: it.likeness,
    style: it.style,
  }));
  return {
    items,
    prompts: parsed.data.prompts,
    mode: parsed.data.mode,
    turbo: parsed.data.turbo,
    style_on: parsed.data.style_on,
    likeness_refs: parsed.data.likeness_refs,
  };
}

const HistoricalRunSchema = z.looseObject({
  id: z.string(),
  lora: z.string(),
  family: z.string(),
  family_label: z.string().optional(),
  image_folder: z.string().optional().default(""),
  output_dir: z.string().optional().default(""),
  result: z.string().optional(),
  status: z.string().optional(),
  started_at: z.number().optional().default(0),
  ended_at: z.number().nullable().optional(),
  finished_at: z.number().nullable().optional(),
  duration: z.number().optional(),
  curve: z.array(z.tuple([z.number(), z.number()])).optional(),
  epochs: z.number().optional(),
  epoch: z.number().optional(),
  lowest_loss: z.number().optional(),
  lowest_epoch: z.number().optional(),
  loss_spark: z.array(z.number()).optional(),
  notes: z.string().optional(),
  values: z.record(z.string(), z.unknown()).optional().default({}),
});

const RunsEnvelopeSchema = z.object({
  runs: z.array(HistoricalRunSchema).optional().default([]),
});

export function parseHistoricalRunsResponse(raw: unknown): HistoricalRun[] {
  const parsed = RunsEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.runs.map((r) => ({
    id: r.id,
    lora: r.lora,
    family: r.family,
    family_label: r.family_label,
    image_folder: r.image_folder,
    output_dir: r.output_dir,
    result: r.result ?? r.status,
    status: r.status ?? r.result,
    started_at: r.started_at,
    ended_at: r.ended_at ?? r.finished_at ?? undefined,
    finished_at: r.finished_at ?? r.ended_at ?? undefined,
    duration: r.duration,
    curve: r.curve,
    epochs: r.epochs,
    epoch: r.epoch,
    lowest_loss: r.lowest_loss,
    lowest_epoch: r.lowest_epoch,
    loss_spark: r.loss_spark,
    notes: r.notes,
    values: r.values,
  }));
}

export function parseLossResponse(raw: unknown): LossDataPoint[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const parsed: LossDataPoint[] = [];

  if (Array.isArray(obj.points)) {
    for (const item of obj.points) {
      if (Array.isArray(item)) {
        const [step, epoch, loss, lr] = item;
        if (typeof step === "number" && typeof loss === "number") {
          parsed.push({
            step,
            loss,
            epoch: typeof epoch === "number" ? epoch : undefined,
            lr: typeof lr === "number" ? lr : undefined,
          });
        }
      } else if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        if (typeof rec.step === "number" && typeof rec.loss === "number") {
          parsed.push({
            step: rec.step,
            loss: rec.loss,
            epoch: typeof rec.epoch === "number" ? rec.epoch : undefined,
            lr: typeof rec.lr === "number" ? rec.lr : undefined,
          });
        }
      }
    }
    return parsed;
  }

  if (Array.isArray(obj.steps) && Array.isArray(obj.losses)) {
    const lrArr = Array.isArray(obj.lr) ? obj.lr : undefined;
    const len = Math.min(obj.steps.length, obj.losses.length);
    for (let i = 0; i < len; i++) {
      const step = obj.steps[i];
      const loss = obj.losses[i];
      const lr = lrArr?.[i];
      if (typeof step === "number" && typeof loss === "number") {
        parsed.push({
          step,
          loss,
          lr: typeof lr === "number" ? lr : undefined,
        });
      }
    }
  }

  return parsed;
}

const CaptionEntrySchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  caption: z.string().optional().default(""),
  width: z.number().optional(),
  height: z.number().optional(),
  removed: z.boolean().optional(),
});

const CaptionsEnvelopeSchema = z.object({
  items: z.array(CaptionEntrySchema).optional(),
  images: z.array(CaptionEntrySchema).optional(),
});

export function parseCaptionEntriesResponse(raw: unknown): CaptionEntry[] {
  const parsed = CaptionsEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return [];
  const list = parsed.data.items ?? parsed.data.images ?? [];
  return list.map((item) => ({
    name: item.name,
    path: item.path,
    caption: item.caption,
    width: item.width,
    height: item.height,
    removed: item.removed,
  }));
}
