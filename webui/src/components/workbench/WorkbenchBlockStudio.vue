<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RotateCcw, Save, Sparkles } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { apiGet, apiPost } from "@/api/client";
import { BaseBadge, BaseButton, BaseInput, BaseToggle } from "@/components/common";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  selectedLoraPath: string;
}>();

const runStore = useRunStore();
const composerStore = useComposerStore();

interface StudioBlockItem {
  id: string;
  label: string;
  shortLabel: string;
  cat: string;
  color: string;
  weight: number;
}

interface StudioCategoryMaster {
  id: string;
  name: string;
  color: string;
  blockIds: string[];
  master: number;
}

interface StudioLayoutResponse {
  key?: string;
  name?: string;
  groups?: Array<{
    label: string;
    blocks: Array<{ id: string; label: string; cat?: string; color?: string }>;
  }>;
  masters?: Array<{ cat: string; label: string; color?: string }>;
}

const detectedFamily = ref<string>("");
const detectedFamilyName = ref<string>("");
const blocks = ref<StudioBlockItem[]>([]);
const categories = ref<StudioCategoryMaster[]>([]);
const outputPath = ref<string>("");
const overwriteExisting = ref<boolean>(false);
const saving = ref<boolean>(false);
const draggingIdx = ref<number | null>(null);

function resolveThemeBlockColor(catLabel: string, fallbackIndex = 0): string {
  const lower = catLabel.toLowerCase();
  if (lower.includes("comp") || (lower.includes("style") && !lower.includes("id"))) {
    return "var(--color-block-style-comp)";
  }
  if (lower.includes("style/id") || lower.includes("style_ident")) {
    return "var(--color-block-style-id)";
  }
  if (lower.includes("id/detail") || lower.includes("ident_details")) {
    return "var(--color-block-id-detail)";
  }
  if (lower.includes("identity") || lower.includes("likeness")) {
    return "var(--color-block-identity)";
  }
  if (lower.includes("detail") || lower.includes("texture")) {
    return "var(--color-block-detail)";
  }
  const palette = [
    "var(--color-block-style-comp)",
    "var(--color-block-style-id)",
    "var(--color-block-identity)",
    "var(--color-block-id-detail)",
    "var(--color-block-detail)",
  ];
  return palette[fallbackIndex % palette.length]!;
}

function buildProportionalLayout(count = 38): void {
  const bandDefs = [
    { id: "style_comp", name: "Style & Composition", color: "var(--color-block-style-comp)" },
    { id: "style_id", name: "Style / Identity Overlap", color: "var(--color-block-style-id)" },
    { id: "identity", name: "Core Subject Identity", color: "var(--color-block-identity)" },
    { id: "id_detail", name: "Identity / Anatomy", color: "var(--color-block-id-detail)" },
    { id: "details", name: "Fine Surface & Detail", color: "var(--color-block-detail)" },
  ];

  const items: StudioBlockItem[] = [];
  const catBuckets = bandDefs.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
    blockIds: [] as string[],
    master: 1.0,
  }));

  for (let i = 0; i < count; i++) {
    const bandIdx = Math.min(bandDefs.length - 1, Math.floor((i / count) * bandDefs.length));
    const band = catBuckets[bandIdx]!;
    const id = `block_${i}`;
    band.blockIds.push(id);
    items.push({
      id,
      label: `Block ${i}`,
      shortLabel: String(i),
      cat: band.id,
      color: band.color,
      weight: 1.0,
    });
  }

  blocks.value = items;
  categories.value = catBuckets.filter((c) => c.blockIds.length > 0);
}

async function loadStudioLayoutForLora(loraPath: string): Promise<void> {
  if (loraPath) {
    outputPath.value = loraPath.replace(/\.safetensors$/i, "_eq.safetensors");
  }
  let famKey = composerStore.family || "krea2";
  if (loraPath) {
    try {
      const famRes = await apiGet<{ key?: string; name?: string }>("/api/studio/lorafamily", {
        path: loraPath,
      });
      if (famRes.key) {
        famKey = famRes.key;
        detectedFamilyName.value = famRes.name || famRes.key;
      }
    } catch {
      // Fallback to composer family
    }
  }
  detectedFamily.value = famKey;

  try {
    const layout = await apiGet<StudioLayoutResponse>("/api/studio/layout", { family: famKey });
    if (layout.name) {
      detectedFamilyName.value = layout.name;
    }
    const flatBlocks: StudioBlockItem[] = [];
    const groups = layout.groups ?? [];
    for (const grp of groups) {
      const prefix = groups.length > 1 ? grp.label.charAt(0).toUpperCase() : "";
      for (const blk of grp.blocks) {
        const numMatch = blk.id.match(/(\d+)$/);
        const shortNum = numMatch?.[1] ?? blk.label;
        const catStr = blk.cat || "";
        flatBlocks.push({
          id: blk.id,
          label: `${grp.label} ${blk.label}`.trim(),
          shortLabel: `${prefix}${shortNum}`,
          cat: catStr,
          color: resolveThemeBlockColor(catStr, flatBlocks.length),
          weight: 1.0,
        });
      }
    }

    if (flatBlocks.length === 0) {
      buildProportionalLayout(38);
      return;
    }

    const masters = layout.masters ?? [];
    if (masters.length > 0) {
      const builtCats: StudioCategoryMaster[] = masters.map((m, idx) => {
        const color = resolveThemeBlockColor(m.label || m.cat, idx);
        const matchingIds = flatBlocks
          .filter((b) => b.cat === m.label || b.cat === m.cat)
          .map((b) => b.id);
        return {
          id: m.cat || m.label,
          name: m.label || m.cat,
          color,
          blockIds: matchingIds,
          master: 1.0,
        };
      });
      blocks.value = flatBlocks;
      categories.value = builtCats.filter((c) => c.blockIds.length > 0);
    } else {
      // Partition dynamically detected blocks into 5 semantic bands
      buildProportionalLayout(flatBlocks.length);
      for (let i = 0; i < flatBlocks.length; i++) {
        const src = flatBlocks[i];
        const target = blocks.value[i];
        if (src && target) {
          const oldId = target.id;
          target.id = src.id;
          target.label = src.label;
          target.shortLabel = src.shortLabel;
          for (const cat of categories.value) {
            const pos = cat.blockIds.indexOf(oldId);
            if (pos !== -1) cat.blockIds[pos] = src.id;
          }
        }
      }
    }
  } catch {
    buildProportionalLayout(38);
  }
}

function setCategoryMaster(catId: string, val: number): void {
  const cat = categories.value.find((c) => c.id === catId);
  if (!cat) return;
  const clamped = Math.max(0, Math.min(2, Number(val.toFixed(2))));
  cat.master = clamped;
  const idSet = new Set(cat.blockIds);
  for (const blk of blocks.value) {
    if (idSet.has(blk.id)) {
      blk.weight = clamped;
    }
  }
}

function setSingleBlock(index: number, val: number): void {
  const blk = blocks.value[index];
  if (!blk) return;
  blk.weight = Math.max(0, Math.min(2, Number(val.toFixed(2))));
}

function resetAllBlocks(value = 1.0): void {
  for (const blk of blocks.value) {
    blk.weight = value;
  }
  for (const cat of categories.value) {
    cat.master = value;
  }
}

function applyPresetCurve(preset: "identity" | "style" | "balanced"): void {
  if (preset === "balanced") {
    resetAllBlocks(1.0);
    return;
  }
  for (const cat of categories.value) {
    const lower = cat.name.toLowerCase();
    if (preset === "identity") {
      if (lower.includes("identity") || lower.includes("core")) {
        setCategoryMaster(cat.id, 1.25);
      } else if (lower.includes("id")) {
        setCategoryMaster(cat.id, 1.1);
      } else if (lower.includes("comp") || lower.includes("style")) {
        setCategoryMaster(cat.id, 0.55);
      } else {
        setCategoryMaster(cat.id, 0.85);
      }
    } else if (preset === "style") {
      if (lower.includes("comp") || (lower.includes("style") && !lower.includes("id"))) {
        setCategoryMaster(cat.id, 1.3);
      } else if (lower.includes("detail") || lower.includes("surface")) {
        setCategoryMaster(cat.id, 1.25);
      } else if (lower.includes("identity")) {
        setCategoryMaster(cat.id, 0.45);
      } else {
        setCategoryMaster(cat.id, 0.8);
      }
    }
  }
}

// Vertical pointer-drag scrubbing on individual equalizer columns
function computeWeightFromPointer(ev: PointerEvent, columnEl: HTMLElement): number {
  const rect = columnEl.getBoundingClientRect();
  if (rect.height <= 0) return 1.0;
  const ratioFromBottom = (rect.bottom - ev.clientY) / rect.height;
  return Math.max(0, Math.min(2, Number((ratioFromBottom * 2).toFixed(2))));
}

function onBarPointerDown(idx: number, ev: PointerEvent): void {
  const el = ev.currentTarget as HTMLElement | null;
  if (!el) return;
  el.setPointerCapture(ev.pointerId);
  draggingIdx.value = idx;
  setSingleBlock(idx, computeWeightFromPointer(ev, el));
}

function onBarPointerMove(idx: number, ev: PointerEvent): void {
  if (draggingIdx.value !== idx) return;
  const el = ev.currentTarget as HTMLElement | null;
  if (!el) return;
  setSingleBlock(idx, computeWeightFromPointer(ev, el));
}

function onBarPointerUp(idx: number, ev: PointerEvent): void {
  if (draggingIdx.value === idx) {
    draggingIdx.value = null;
  }
  const el = ev.currentTarget as HTMLElement | null;
  if (el && el.hasPointerCapture(ev.pointerId)) {
    el.releasePointerCapture(ev.pointerId);
  }
}

const modifiedBlocksCount = computed(() => {
  return blocks.value.filter((b) => Math.abs(b.weight - 1.0) > 0.001).length;
});

async function saveSurgicalLora(): Promise<void> {
  if (!props.selectedLoraPath) {
    toast.error("Select a source LoRA checkpoint first");
    return;
  }
  const out = outputPath.value.trim();
  if (!out.toLowerCase().endsWith(".safetensors")) {
    toast.error("Output filename must end in .safetensors");
    return;
  }
  saving.value = true;
  try {
    const weightsMap: Record<string, number> = {};
    for (const blk of blocks.value) {
      weightsMap[blk.id] = blk.weight;
    }
    const res = await apiPost<{ ok?: boolean; exists?: boolean }>("/api/studio/save", {
      out,
      overwrite: overwriteExisting.value,
      include_donor: false,
      state: {
        primary: props.selectedLoraPath,
        family: detectedFamily.value,
        blocks: weightsMap,
      },
    });
    if (res.exists && !overwriteExisting.value) {
      toast.warning("Output file already exists — enable Overwrite if you wish to replace it.");
      return;
    }
    toast.success(`Requested block-weighted export to ${out}`);
    await runStore.fetchCheckpoints();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to save block-weighted LoRA");
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.selectedLoraPath,
  (path) => {
    void loadStudioLayoutForLora(path);
  },
);

onMounted(() => {
  void loadStudioLayoutForLora(props.selectedLoraPath);
});
</script>

<template>
  <div class="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px]">
    <!-- Left: Interactive Parametric Block Equalizer -->
    <div class="flex flex-col gap-4 rounded-xl border border-hairline bg-base-200/80 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-base-content">
              Parametric Block Weight Equalizer ({{ blocks.length }} Blocks)
            </h2>
            <BaseBadge v-if="detectedFamilyName || detectedFamily" variant="primary" mono>
              {{ detectedFamilyName || detectedFamily }}
            </BaseBadge>
            <BaseBadge v-if="modifiedBlocksCount > 0" variant="warning" mono>
              {{ modifiedBlocksCount }} sculpted
            </BaseBadge>
          </div>
          <p class="mt-0.5 text-xs text-muted">
            Click &amp; drag vertically on individual block bars (double-click to reset to 1.00×) or
            sculpt semantic bands on the right.
          </p>
        </div>
        <div class="flex items-center gap-1.5">
          <BaseButton size="compact" variant="ghost" @click="applyPresetCurve('identity')">
            <template #icon-left><Sparkles class="h-3 w-3 text-primary" /></template>
            <span>Lock Identity</span>
          </BaseButton>
          <BaseButton size="compact" variant="ghost" @click="applyPresetCurve('style')">
            <span>Style Only</span>
          </BaseButton>
          <BaseButton size="compact" variant="ghost" @click="resetAllBlocks(1.0)">
            <template #icon-left><RotateCcw class="h-3 w-3" /></template>
            <span>Reset 1.0×</span>
          </BaseButton>
        </div>
      </div>

      <!-- Drag-Interactive Bar Graph Equalizer -->
      <div
        class="relative flex h-64 items-end gap-1 rounded-lg border border-hairline bg-base-100 px-3 pb-7 pt-6 select-none touch-none"
      >
        <!-- 1.0x Unity Reference Line -->
        <div
          class="pointer-events-none absolute left-0 right-0 border-t border-dashed border-hairline-strong"
          style="bottom: calc(50% + 4px)"
        >
          <span class="absolute right-2 -top-4 font-mono text-[10px] text-muted">
            1.00× unity
          </span>
        </div>

        <div
          v-for="(blk, idx) in blocks"
          :key="blk.id"
          class="group relative flex h-full flex-1 flex-col items-center justify-end cursor-ns-resize"
          @pointerdown="onBarPointerDown(idx, $event)"
          @pointermove="onBarPointerMove(idx, $event)"
          @pointerup="onBarPointerUp(idx, $event)"
          @pointercancel="onBarPointerUp(idx, $event)"
          @dblclick="setSingleBlock(idx, 1.0)"
        >
          <!-- Tooltip on hover / drag -->
          <div
            class="pointer-events-none absolute -top-5 z-10 rounded border border-hairline-strong bg-base-300 px-1.5 py-0.5 font-mono text-[10px] text-base-content whitespace-nowrap"
            :class="draggingIdx === idx ? 'block' : 'hidden group-hover:block'"
          >
            {{ blk.shortLabel }}: {{ blk.weight.toFixed(2) }}×
          </div>

          <!-- Bar column -->
          <div
            class="relative flex h-full w-full items-end overflow-hidden rounded-t bg-base-300/60"
          >
            <div
              class="w-full rounded-t"
              :class="draggingIdx === idx ? '' : 'transition-all duration-75'"
              :style="{
                height: `${Math.min(100, (blk.weight / 2) * 100)}%`,
                backgroundColor: blk.color,
                opacity: blk.weight === 0 ? 0.2 : 0.92,
              }"
            />
          </div>

          <!-- Block short label -->
          <span class="absolute -bottom-5 font-mono text-[9px] text-muted truncate max-w-full">
            {{ blk.shortLabel }}
          </span>
        </div>
      </div>

      <!-- Compact Numeric Fine-Tune Strip (Responsive without horizontal overflow) -->
      <div class="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 2xl:grid-cols-10 pt-2">
        <div
          v-for="(blk, idx) in blocks"
          :key="`num-${blk.id}`"
          class="flex items-center justify-between gap-1 rounded border border-hairline bg-base-300/50 px-2 py-1"
        >
          <span
            class="font-mono text-[10px] font-semibold truncate"
            :style="{ color: blk.color }"
            :title="blk.label"
          >
            {{ blk.shortLabel }}
          </span>
          <input
            :value="blk.weight"
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

    <!-- Right: Semantic Category Master Sliders & Surgical Export -->
    <div
      class="flex flex-col justify-between gap-4 rounded-xl border border-hairline bg-base-200/80 p-4"
    >
      <div class="space-y-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-subtle">
          Semantic Category Multipliers
        </h3>

        <div
          v-for="cat in categories"
          :key="cat.id"
          class="rounded-lg border border-hairline bg-base-300/50 p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: cat.color }"
              />
              <span class="text-xs font-semibold text-base-content truncate">
                {{ cat.name }}
              </span>
            </div>
            <span class="font-mono text-xs text-subtle shrink-0">
              {{ cat.master.toFixed(2) }}×
            </span>
          </div>

          <input
            :value="cat.master"
            type="range"
            min="0"
            max="2"
            step="0.05"
            class="range range-xs range-primary w-full"
            @input="setCategoryMaster(cat.id, Number(($event.target as HTMLInputElement).value))"
          />

          <div class="font-mono text-[10px] text-muted truncate">
            {{ cat.blockIds.length }} block(s)
          </div>
        </div>
      </div>

      <div class="space-y-2.5 border-t border-hairline pt-3">
        <div>
          <label class="mb-1 block text-[11px] font-semibold text-subtle">
            Output Safetensors Path
          </label>
          <BaseInput
            v-model="outputPath"
            size="compact"
            mono
            placeholder="/workspace/output_loras/model_eq.safetensors"
          />
        </div>

        <BaseToggle
          v-model="overwriteExisting"
          size="compact"
          label="Allow overwriting existing file"
        />

        <BaseButton
          variant="primary"
          class="w-full"
          :disabled="saving || !selectedLoraPath"
          @click="saveSurgicalLora"
        >
          <template #icon-left><Save class="h-4 w-4" /></template>
          <span>{{ saving ? "Exporting..." : "Export Block-Weighted LoRA" }}</span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>
