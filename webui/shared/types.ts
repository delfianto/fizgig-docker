export type RowKind =
  | "blocks"
  | "cadence"
  | "check"
  | "choice"
  | "combo"
  | "entry"
  | "folder"
  | "note"
  | "path"
  | "radio"
  | "shown"
  | "split"
  | "text"
  | null;

export interface SchemaRow {
  key: string;
  label: string;
  kind: RowKind;
  hint?: string;
  choices?: string[];
  labels?: Record<string, string>;
  default?: string | number | boolean;
  suffix?: string;
  group?: string;
  group_label?: string;
  lines?: number;
  parts?: Array<{
    key: string;
    label?: string;
    default?: string | number | boolean;
  }>;
  sets?: Record<string, Record<string, unknown>>;
  option?: string;
  action?: string;
}

export interface SchemaSection {
  id: string;
  title: string;
  tab: "training" | "samples" | string;
  collapsible?: boolean | null;
  open?: boolean | null;
  rows: Array<SchemaRow | null>;
}

export interface FamilyPreset {
  name: string;
  values: Record<string, unknown>;
}

export interface ModelFileSpec {
  role: string;
  pref_key: string;
  label: string;
  hint?: string;
  optional?: boolean;
}

export interface BlockCategory {
  name: string;
  color?: string;
  blocks: number[];
}

export interface FamilyDescription {
  key: string;
  arch_id?: string;
  display_name: string;
  gui_label?: string;
  lora_name_suffix?: string;
  media: string[];
  experimental?: boolean;
  n_blocks?: number;
  model_files: ModelFileSpec[];
  model_keys: string[];
  model_note?: string;
  status_note?: string;
  preset_notes?: Record<string, string>;
  presets: FamilyPreset[];
  block_categories?: BlockCategory[];
  form: {
    sections: SchemaSection[];
    presets: FamilyPreset[];
  };
}

export interface SchemaResponse {
  families: FamilyDescription[];
  order: string[];
  news?: Array<{
    title: string;
    date: string;
    text: string;
  }>;
}

export interface FormStateResponse {
  kind: "standard" | "slider" | "finetune" | "edit" | string;
  hidden: string[];
  disabled: string[];
  notes: Record<string, string>;
  placeholders?: Record<string, string>;
  pending?: boolean;
}

export interface RunProgress {
  epoch: number;
  total_epochs: number;
  step: number;
  total_steps: number;
  speed: string;
  loss: string;
  eta: string;
  percent: number;
  note: string;
  lr: string;
  grad_norm: string;
}

export interface QueueItemSummary {
  id: string;
  family: string;
  lora: string;
  image_folder: string;
  summary?: string;
  values?: Record<string, unknown>;
}

export interface WebQueueState {
  items: QueueItemSummary[];
  held: boolean;
  reason: string;
  waiting: string;
}

export interface LiveRunResponse {
  state: "idle" | "starting" | "running" | "pausing" | "paused" | "stopping" | string;
  stage: string;
  lora: string;
  output_dir: string;
  family: string;
  values: Record<string, unknown>;
  image_folder: string;
  pause: boolean;
  resume: string;
  resume_mode: string;
  history_id: string;
  progress: RunProgress | null;
  started_at: number | null;
  training_at: number | null;
  running: boolean;
  web_queue: WebQueueState;
}

export interface GpuDeviceInfo {
  index: number;
  name: string;
  vram: [number, number]; // [used_bytes, total_bytes]
  util: number; // GPU Load % (0-100)
  temp: number; // GPU Temp °C
  power?: number; // Power W
  power_limit?: number; // Power Cap W
}

export interface CpuTelemetryInfo {
  util: number; // CPU Load % (0-100)
  temp: number | null; // CPU Temp °C
  cores?: number;
}

export interface GpuStatsResponse {
  vram: [number, number];
  ram: [number, number];
  vram_peak: number;
  ram_peak: number;
  device_name: string;
  disk: {
    used: number;
    total: number;
    free: number;
    where: string;
    path: string;
  };
  jobs: Array<{ what: string; name?: string }>;
  loaded: Array<{ what: string; name: string; tab: string }>;

  // Enriched Hardware Telemetry
  gpu_util?: number;
  gpu_temp?: number;
  cpu_util?: number;
  cpu_temp?: number | null;
  gpus?: GpuDeviceInfo[];
  cpu?: CpuTelemetryInfo;
}

export interface LossDataPoint {
  step: number;
  loss: number;
  epoch?: number;
  lr?: number;
}

export interface RunLossResponse {
  points?: Array<[number, number, number?, number?] | LossDataPoint>;
  steps?: number[];
  losses?: number[];
  epochs?: Array<{ epoch: number; step: number; avg?: number }>;
  lr?: number[];
}

export interface SampleItem {
  name: string;
  path: string;
  epoch: number;
  prompt_index?: number;
  idx?: number;
  prompt?: string;
  seed?: number | string;
  mtime?: number;
  time?: number;
  likeness?: number | null;
  style?: number | null;
}

export interface SamplesResponse {
  items: SampleItem[];
  prompts?: string[];
  mode?: string;
  turbo?: boolean;
  style_on?: boolean;
  likeness_refs?: string[];
}

export interface CheckpointItem {
  name: string;
  path: string;
  run: string;
  size: number;
  mtime: number;
  epoch?: number;
}

export interface HistoricalRun {
  id: string;
  lora: string;
  family: string;
  family_label?: string;
  image_folder: string;
  output_dir: string;
  result?: string;
  status?: string;
  started_at: number;
  ended_at?: number;
  finished_at?: number;
  duration?: number;
  curve?: Array<[number, number]>;
  epochs?: number;
  epoch?: number;
  lowest_loss?: number;
  lowest_epoch?: number;
  loss_spark?: number[];
  notes?: string;
  values: Record<string, unknown>;
}

export interface DatasetSummary {
  name: string;
  path: string;
  count: number;
  captioned?: number;
  mtime?: number;
  size?: number;
  media?: string;
}

export interface CaptionEntry {
  name: string;
  path: string;
  caption: string;
  width?: number;
  height?: number;
  removed?: boolean;
}

export interface PlanValidationResponse {
  ok?: boolean;
  problems?: string[];
  warnings?: string[];
  summary?: Record<string, unknown>;
}

export interface LocalBundlesResponse {
  available: boolean;
  catalogPath: string | null;
  active: string[];
  bundles: Record<
    string,
    {
      family: string;
      description?: string;
      preferences: Record<string, Record<string, unknown>>;
    }
  >;
  externalRoots?: Record<string, string>;
}
