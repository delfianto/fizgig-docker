<script setup lang="ts">
import { ref } from "vue";
import { RotateCcw, Save, Sparkles } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { apiPost } from "@/api/client";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  selectedLoraPath: string;
}>();

const runStore = useRunStore();

const blockCount = ref(38);
const blockWeights = ref<number[]>(Array.from({ length: 38 }, () => 1.0));

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
  if (!props.selectedLoraPath) {
    toast.error("Select a LoRA checkpoint first");
    return;
  }
  try {
    const weightsMap: Record<string, number> = {};
    blockWeights.value.forEach((w, idx) => {
      weightsMap[String(idx)] = w;
    });
    const res = await apiPost<{ path?: string; note?: string }>("/api/studio/save_lora", {
      path: props.selectedLoraPath,
      lora_path: props.selectedLoraPath,
      weights: weightsMap,
      block_weights: blockWeights.value,
    });
    toast.success(res.note ?? `Saved block-weighted LoRA ${res.path ?? ""}`);
    await runStore.fetchCheckpoints();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to save LoRA");
  }
}
</script>

<template>
  <div class="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px]">
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
            class="btn btn-sm h-7.5 rounded-md btn-ghost border border-hairline bg-base-100 hover:border-primary text-xs font-semibold px-2.5 gap-1.5 cursor-pointer transition"
            @click="applyPresetCurve('identity')"
          >
            <Sparkles class="h-3 w-3 text-secondary" />
            <span>Lock Identity</span>
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 rounded-md btn-ghost border border-hairline bg-base-100 hover:border-primary text-xs font-semibold px-2.5 gap-1.5 cursor-pointer transition"
            @click="applyPresetCurve('style')"
          >
            <span>Style Only</span>
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 rounded-md btn-ghost border border-hairline bg-base-100 hover:border-primary text-xs font-semibold px-2.5 gap-1.5 cursor-pointer transition"
            @click="resetAllBlocks(1.0)"
          >
            <RotateCcw class="h-3 w-3" />
            <span>Reset 1.0×</span>
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
          @mousedown="setSingleBlock(idx, weight === 1 ? 0 : 1)"
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
        <button
          type="button"
          class="btn btn-primary btn-sm h-8.5 rounded-lg w-full cursor-pointer gap-2 text-xs font-semibold shadow-xs"
          @click="saveSurgicalLora"
        >
          <Save class="h-4 w-4" />
          <span>Export Block-Weighted LoRA</span>
        </button>
      </div>
    </div>
  </div>
</template>
