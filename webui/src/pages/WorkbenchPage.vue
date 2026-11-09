<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Activity,
  Download,
  FileCode2,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Trophy,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type CheckpointItem } from "@shared/types";
import { apiGet, apiPost, downloadUrl } from "@/api/client";
import { useRunStore } from "@/stores/run";

const runStore = useRunStore();

const activeTool = ref<"studio" | "royale" | "profiler" | "metadata">("studio");
const selectedLoraPath = ref<string>("");

// Block Studio Parametric Equalizer state (38 blocks default for Flux/Krea/Z-Image/SDXL)
const blockCount = ref(38);
const blockWeights = ref<number[]>(Array.from({ length: 38 }, () => 1.0));
const draggingBlock = ref<number | null>(null);

// 5 Semantic Category Master Multipliers
const categories = ref([
  {
    id: "composition",
    name: "Composition & Pose",
    color: "#3b82f6",
    blocks: [0, 1, 2, 3, 4, 5, 6],
    master: 1.0,
  },
  {
    id: "identity",
    name: "Subject Identity & Likeness",
    color: "#8b5cf6",
    blocks: [7, 8, 9, 10, 11, 12, 13, 14, 15],
    master: 1.0,
  },
  {
    id: "structure",
    name: "Core Structure & Anatomy",
    color: "#10b981",
    blocks: [16, 17, 18, 19, 20, 21, 22, 23],
    master: 1.0,
  },
  {
    id: "lighting",
    name: "Lighting & Color Palette",
    color: "#f59e0b",
    blocks: [24, 25, 26, 27, 28, 29, 30],
    master: 1.0,
  },
  {
    id: "texture",
    name: "Fine Surface & Micro-Detail",
    color: "#ec4899",
    blocks: [31, 32, 33, 34, 35, 36, 37],
    master: 1.0,
  },
]);

// Metadata Inspector state
const metadataJson = ref<Record<string, unknown> | null>(null);
const loadingMetadata = ref(false);

// Profiler & Royale status
const profilerStatus = ref<Record<string, unknown> | null>(null);
const royaleStatus = ref<Record<string, unknown> | null>(null);

const selectedCheckpoint = computed<CheckpointItem | undefined>(() =>
  runStore.checkpoints.find((c) => c.path === selectedLoraPath.value),
);

function blockColor(index: number): string {
  for (const cat of categories.value) {
    if (cat.blocks.includes(index)) return cat.color;
  }
  return "#6366f1";
}

function setCategoryMaster(catId: string, val: number): void {
  const cat = categories.value.find((c) => c.id === catId);
  if (!cat) return;
  cat.master = val;
  const next = [...blockWeights.value];
  for (const idx of cat.blocks) {
    if (idx < next.length) {
      next[idx] = Number(val.toFixed(2));
    }
  }
  blockWeights.value = next;
}

function setSingleBlock(index: number, val: number): void {
  const clamped = Math.max(0, Math.min(2, Number(val.toFixed(2))));
  const next = [...blockWeights.value];
  next[index] = clamped;
  blockWeights.value = next;
}

function resetAllBlocks(value = 1.0): void {
  blockWeights.value = Array.from({ length: blockCount.value }, () => value);
  for (const cat of categories.value) {
    cat.master = value;
  }
}

function applyPresetCurve(preset: "identity" | "style" | "balanced"): void {
  if (preset === "balanced") {
    resetAllBlocks(1.0);
    return;
  }
  if (preset === "identity") {
    setCategoryMaster("composition", 0.6);
    setCategoryMaster("identity", 1.25);
    setCategoryMaster("structure", 1.15);
    setCategoryMaster("lighting", 0.7);
    setCategoryMaster("texture", 0.85);
  } else if (preset === "style") {
    setCategoryMaster("composition", 0.85);
    setCategoryMaster("identity", 0.5);
    setCategoryMaster("structure", 0.8);
    setCategoryMaster("lighting", 1.3);
    setCategoryMaster("texture", 1.25);
  }
}

async function saveSurgicalLora(): Promise<void> {
  if (!selectedLoraPath.value) {
    toast.error("Select a LoRA checkpoint first");
    return;
  }
  try {
    const weightsMap: Record<string, number> = {};
    blockWeights.value.forEach((w, idx) => {
      weightsMap[String(idx)] = w;
    });
    const res = await apiPost<{ path?: string; note?: string }>("/api/studio/save_lora", {
      path: selectedLoraPath.value,
      lora_path: selectedLoraPath.value,
      weights: weightsMap,
      block_weights: blockWeights.value,
    });
    toast.success(res.note ?? `Saved block-weighted LoRA ${res.path ?? ""}`);
    await runStore.fetchCheckpoints();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to save LoRA");
  }
}

async function inspectSafetensorsMetadata(): Promise<void> {
  if (!selectedLoraPath.value) return;
  loadingMetadata.value = true;
  try {
    metadataJson.value = await apiGet<Record<string, unknown>>("/api/metadata", {
      path: selectedLoraPath.value,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to read safetensors header");
  } finally {
    loadingMetadata.value = false;
  }
}

async function loadProfilerAndRoyale(): Promise<void> {
  try {
    const [prof, roy] = await Promise.all([
      apiGet<Record<string, unknown>>("/api/profile/status").catch(() => null),
      apiGet<Record<string, unknown>>("/api/royale/status").catch(() => null),
    ]);
    profilerStatus.value = prof;
    royaleStatus.value = roy;
  } catch {
    // Ignore
  }
}

onMounted(async () => {
  await runStore.fetchCheckpoints();
  if (!selectedLoraPath.value && runStore.checkpoints.length > 0) {
    selectedLoraPath.value = runStore.checkpoints[0]!.path;
  }
  await loadProfilerAndRoyale();
});
</script>

<template>
  <div class="flex h-[calc(100vh-44px)] flex-col overflow-hidden bg-base-100">
    <!-- Top Workbench Bar -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-200/50 px-4 py-2.5"
    >
      <div class="flex items-center gap-2">
        <div class="join">
          <button
            type="button"
            class="btn btn-xs join-item gap-1.5"
            :class="activeTool === 'studio' ? 'btn-primary' : 'btn-ghost'"
            @click="activeTool = 'studio'"
          >
            <Sliders class="h-3.5 w-3.5" />
            Block Studio EQ
          </button>
          <button
            type="button"
            class="btn btn-xs join-item gap-1.5"
            :class="activeTool === 'royale' ? 'btn-primary' : 'btn-ghost'"
            @click="activeTool = 'royale'"
          >
            <Trophy class="h-3.5 w-3.5" />
            LoRA Royale
          </button>
          <button
            type="button"
            class="btn btn-xs join-item gap-1.5"
            :class="activeTool === 'profiler' ? 'btn-primary' : 'btn-ghost'"
            @click="activeTool = 'profiler'"
          >
            <Activity class="h-3.5 w-3.5" />
            Block Profiler
          </button>
          <button
            type="button"
            class="btn btn-xs join-item gap-1.5"
            :class="activeTool === 'metadata' ? 'btn-primary' : 'btn-ghost'"
            @click="
              activeTool = 'metadata';
              inspectSafetensorsMetadata();
            "
          >
            <FileCode2 class="h-3.5 w-3.5" />
            Safetensors Metadata
          </button>
        </div>
      </div>

      <!-- Target LoRA Checkpoint Selector -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-base-content/60">Target LoRA:</span>
        <select
          v-model="selectedLoraPath"
          class="select select-xs select-bordered bg-base-300/70 font-mono text-xs min-w-72"
          @change="activeTool === 'metadata' && inspectSafetensorsMetadata()"
        >
          <option v-for="ckpt in runStore.checkpoints" :key="ckpt.path" :value="ckpt.path">
            {{ ckpt.run ? `[${ckpt.run}] ` : "" }}{{ ckpt.name }}
          </option>
        </select>
        <a
          v-if="selectedCheckpoint"
          :href="downloadUrl(selectedCheckpoint.path)"
          class="btn btn-xs btn-ghost border border-base-300"
          title="Download .safetensors"
        >
          <Download class="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          title="Refresh checkpoints"
          @click="runStore.fetchCheckpoints()"
        >
          <RefreshCw class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Tool 1: Block Studio Parametric Equalizer (Replaces 769-input wall) -->
    <div
      v-if="activeTool === 'studio'"
      class="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px]"
    >
      <!-- Left: Interactive Parametric Block Equalizer -->
      <div class="flex flex-col gap-4 rounded-lg border border-base-300 bg-base-200/70 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold text-base-content">
              Parametric Block Weight Equalizer ({{ blockCount }} Transformer Blocks)
            </h2>
            <p class="text-xs text-base-content/55">
              Drag individual block bars or adjust the 5 semantic category sliders on the right to
              sculpt identity vs. style retention without mounting 769 raw inputs.
            </p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="btn btn-xs btn-outline border-base-300"
              @click="applyPresetCurve('identity')"
            >
              <Sparkles class="h-3 w-3 text-secondary" />
              Lock Identity
            </button>
            <button
              type="button"
              class="btn btn-xs btn-outline border-base-300"
              @click="applyPresetCurve('style')"
            >
              Style Only
            </button>
            <button type="button" class="btn btn-xs btn-ghost" @click="resetAllBlocks(1.0)">
              <RotateCcw class="h-3 w-3" />
              Reset 1.0×
            </button>
          </div>
        </div>

        <!-- Bar Graph Equalizer -->
        <div
          class="relative flex h-64 items-end gap-1 rounded-lg border border-base-300 bg-base-100/80 px-3 pb-7 pt-6 select-none"
        >
          <!-- 1.0x Unity Reference Line -->
          <div
            class="pointer-events-none absolute left-0 right-0 border-t border-dashed border-base-content/25"
            style="bottom: calc(50% + 4px)"
          >
            <span class="absolute right-2 -top-4 font-mono text-[10px] text-base-content/40">
              1.00× unity
            </span>
          </div>

          <div
            v-for="(weight, idx) in blockWeights"
            :key="idx"
            class="group relative flex h-full flex-1 flex-col items-center justify-end cursor-ns-resize"
            @mousedown="
              draggingBlock = idx;
              setSingleBlock(idx, weight === 1 ? 0 : 1);
            "
          >
            <!-- Tooltip on hover -->
            <div
              class="pointer-events-none absolute -top-5 z-10 hidden rounded bg-base-300 px-1.5 py-0.5 font-mono text-[10px] text-base-content shadow group-hover:block"
            >
              B{{ idx }}: {{ weight.toFixed(2) }}
            </div>

            <!-- Bar column -->
            <div
              class="relative flex h-full w-full items-end overflow-hidden rounded-t bg-base-300/40"
            >
              <div
                class="w-full rounded-t transition-all duration-75"
                :style="{
                  height: `${Math.min(100, (weight / 2) * 100)}%`,
                  backgroundColor: blockColor(idx),
                  opacity: weight === 0 ? 0.2 : 0.9,
                }"
              />
            </div>

            <!-- Block index label -->
            <span class="absolute -bottom-5 font-mono text-[9px] text-base-content/45">
              {{ idx }}
            </span>
          </div>
        </div>

        <!-- Compact Numeric Fine-Tune Strip -->
        <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-10 md:grid-cols-13 pt-2">
          <div
            v-for="(weight, idx) in blockWeights"
            :key="`num-${idx}`"
            class="flex items-center justify-between rounded border border-base-300/80 bg-base-300/40 px-1.5 py-1"
          >
            <span class="font-mono text-[10px] font-semibold" :style="{ color: blockColor(idx) }">
              B{{ idx }}
            </span>
            <input
              :value="weight"
              type="number"
              step="0.05"
              min="0"
              max="2"
              class="w-11 bg-transparent text-right font-mono text-[11px] text-base-content focus:outline-none"
              @input="setSingleBlock(idx, Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <!-- Right: 5 Category Master Sliders & Export -->
      <div
        class="flex flex-col justify-between gap-4 rounded-lg border border-base-300 bg-base-200/70 p-4"
      >
        <div class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
            Semantic Category Multipliers
          </h3>

          <div
            v-for="cat in categories"
            :key="cat.id"
            class="rounded-lg border border-base-300 bg-base-300/40 p-3 space-y-2"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: cat.color }" />
                <span class="text-xs font-semibold text-base-content">
                  {{ cat.name }}
                </span>
              </div>
              <span class="font-mono text-xs text-base-content/80">
                {{ cat.master.toFixed(2) }}×
              </span>
            </div>

            <input
              :value="cat.master"
              type="range"
              min="0"
              max="2"
              step="0.05"
              class="range range-xs w-full"
              @input="setCategoryMaster(cat.id, Number(($event.target as HTMLInputElement).value))"
            />

            <div class="font-mono text-[10px] text-base-content/45">
              Blocks: {{ cat.blocks.join(", ") }}
            </div>
          </div>
        </div>

        <div class="space-y-2 border-t border-base-300 pt-3">
          <button type="button" class="btn btn-primary btn-sm w-full" @click="saveSurgicalLora">
            <Save class="h-4 w-4" />
            Export Block-Weighted LoRA
          </button>
        </div>
      </div>
    </div>

    <!-- Tool 2: LoRA Royale Checkpoint Crossfader -->
    <div v-else-if="activeTool === 'royale'" class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-4xl rounded-lg border border-base-300 bg-base-200 p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-base-content">
              LoRA Royale — Multi-Epoch Tournament & Likeness Arena
            </h2>
            <p class="text-xs text-base-content/60">
              Compare saved epoch checkpoints side-by-side using identical seeds and automated
              likeness/style scoring.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          <div
            v-for="ckpt in runStore.checkpoints.slice(0, 12)"
            :key="ckpt.path"
            class="flex items-center justify-between rounded border border-base-300 bg-base-300/50 px-3 py-2"
          >
            <div class="min-w-0">
              <div class="truncate font-mono text-xs font-semibold text-base-content">
                {{ ckpt.name }}
              </div>
              <div class="font-mono text-[10px] text-base-content/50">
                {{ ckpt.run || "root" }}
              </div>
            </div>
            <span class="badge badge-xs badge-primary font-mono"> ep {{ ckpt.epoch ?? "?" }} </span>
          </div>
        </div>

        <div v-if="royaleStatus" class="rounded bg-base-300/70 p-3 font-mono text-xs">
          {{ JSON.stringify(royaleStatus, null, 2) }}
        </div>
      </div>
    </div>

    <!-- Tool 3: Block Profiler -->
    <div v-else-if="activeTool === 'profiler'" class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-4xl rounded-lg border border-base-300 bg-base-200 p-5 space-y-4">
        <h2 class="text-sm font-semibold text-base-content">Automated Block Importance Profiler</h2>
        <p class="text-xs text-base-content/60">
          Measure per-block gradient norm and reconstruction delta across transformer blocks for the
          selected LoRA checkpoint.
        </p>
        <div v-if="profilerStatus" class="rounded bg-base-300/70 p-3 font-mono text-xs">
          {{ JSON.stringify(profilerStatus, null, 2) }}
        </div>
      </div>
    </div>

    <!-- Tool 4: Safetensors Header Metadata Inspector -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-4xl rounded-lg border border-base-300 bg-base-200 p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-base-content">
            Safetensors Header Metadata (`__metadata__`)
          </h2>
          <button
            type="button"
            class="btn btn-xs btn-outline border-base-300"
            :disabled="loadingMetadata"
            @click="inspectSafetensorsMetadata"
          >
            Reload Header
          </button>
        </div>
        <div v-if="loadingMetadata" class="text-xs text-base-content/50">
          Reading safetensors header...
        </div>
        <pre
          v-else-if="metadataJson"
          class="max-h-[65vh] overflow-auto rounded border border-base-300 bg-base-300/70 p-3 font-mono text-xs text-base-content/85"
          >{{ JSON.stringify(metadataJson, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
