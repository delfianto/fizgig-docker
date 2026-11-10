<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  ChevronLeft,
  ChevronRight,
  Columns,
  Columns2,
  Eye,
  GalleryHorizontal,
  Grid,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
} from "lucide-vue-next";
import { type SampleItem } from "@shared/types";
import { mediaUrl, thumbUrl } from "@/api/client";
import BaseButton from "@/components/common/BaseButton.vue";
import BasePillGroup from "@/components/common/BasePillGroup.vue";

const props = defineProps<{
  items: SampleItem[];
  prompts: string[];
  highlightedEpoch: number | null;
  modeNote?: string;
  paneMode?: "collapsed" | "split" | "wide";
}>();

const emit = defineEmits<{
  openOverrideDrawer: [];
  setPaneMode: [mode: "collapsed" | "split" | "wide"];
}>();

// View Mode: Matrix (table) | Carousel (focused multi-prompt inspector) | Stream (chronological cards)
const viewMode = ref<"matrix" | "carousel" | "chronological">("matrix");

// Selected sample for Lightbox / A-B Crossfade modal
const selectedSample = ref<SampleItem | null>(null);
const comparePinned = ref<SampleItem | null>(null);
const crossfadeAlpha = ref<number>(0.5);

// Prompt filtering inside Matrix mode (for runs with > 2 prompts)
const selectedPromptFilter = ref<number | "all">("all");

// Carousel Mode State
const carouselEpoch = ref<number>(0);
const carouselPromptIdx = ref<number>(0);
const carouselComparePinned = ref<SampleItem | null>(null);
const carouselCrossfadeAlpha = ref<number>(0.5);

function promptIdx(item?: SampleItem | null): number {
  if (!item) return 0;
  return item.prompt_index ?? item.idx ?? 0;
}

// Group samples by epoch (descending)
const epochsList = computed(() => {
  const epSet = new Set<number>();
  for (const item of props.items) {
    epSet.add(item.epoch ?? 0);
  }
  return [...epSet].toSorted((a, b) => b - a);
});

// Prompt column descriptors
const promptColumns = computed(() => {
  const maxPromptIdx = props.items.reduce(
    (max, item) => Math.max(max, promptIdx(item)),
    Math.max(0, props.prompts.length - 1),
  );
  const cols: Array<{ index: number; text: string }> = [];
  for (let i = 0; i <= maxPromptIdx; i++) {
    cols.push({
      index: i,
      text: props.prompts[i] ?? `Prompt ${i + 1}`,
    });
  }
  return cols;
});

// Filtered prompt columns for Matrix display
const visiblePromptColumns = computed(() => {
  if (selectedPromptFilter.value === "all") {
    return promptColumns.value;
  }
  return promptColumns.value.filter((col) => col.index === selectedPromptFilter.value);
});

// Fast lookup key: "epoch:promptIndex"
const matrixMap = computed(() => {
  const map = new Map<string, SampleItem>();
  for (const item of props.items) {
    const key = `${item.epoch ?? 0}:${promptIdx(item)}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return map;
});

function getCell(epoch: number, pIndex: number): SampleItem | undefined {
  return matrixMap.value.get(`${epoch}:${pIndex}`);
}

// Ensure carousel selection defaults to the latest epoch and first prompt
watch(
  [() => props.items, epochsList],
  ([items, epochs]) => {
    if (items.length > 0 && epochs.length > 0) {
      if (!epochs.includes(carouselEpoch.value)) {
        carouselEpoch.value = epochs[0] ?? 0;
      }
      if (carouselPromptIdx.value >= promptColumns.value.length) {
        carouselPromptIdx.value = 0;
      }
    }
  },
  { immediate: true },
);

// Current sample for Carousel mode
const carouselCurrentSample = computed<SampleItem | null>(() => {
  const direct = getCell(carouselEpoch.value, carouselPromptIdx.value);
  if (direct) return direct;
  const inEpoch = props.items.find((it) => it.epoch === carouselEpoch.value);
  return inEpoch ?? props.items[0] ?? null;
});

// All samples for the currently selected carousel epoch
const carouselEpochSamples = computed(() => {
  return props.items.filter((it) => it.epoch === carouselEpoch.value);
});

function stepCarouselEpoch(delta: number): void {
  const sorted = epochsList.value; // e.g. [4, 3, 2, 1, 0] (descending)
  const pos = sorted.indexOf(carouselEpoch.value);
  if (pos === -1) return;
  // delta > 0 means next newer epoch (pos - delta), delta < 0 means older epoch (pos + abs(delta))
  const targetPos = pos - delta;
  if (targetPos >= 0 && targetPos < sorted.length) {
    carouselEpoch.value = sorted[targetPos]!;
  }
}

function stepCarouselPrompt(delta: number): void {
  const total = promptColumns.value.length;
  if (total <= 1) return;
  let next = carouselPromptIdx.value + delta;
  if (next < 0) next = total - 1;
  if (next >= total) next = 0;
  carouselPromptIdx.value = next;
}

function stepEpochInLightbox(delta: number): void {
  if (!selectedSample.value) return;
  const currentEp = selectedSample.value.epoch ?? 0;
  const pIndex = promptIdx(selectedSample.value);
  const sortedAsc = [...epochsList.value].toSorted((a, b) => a - b);
  const pos = sortedAsc.indexOf(currentEp);
  const nextEp = sortedAsc[pos + delta];
  if (nextEp !== undefined) {
    const candidate = getCell(nextEp, pIndex);
    if (candidate) {
      selectedSample.value = candidate;
    }
  }
}

// Global keyboard navigation helper
function handleKeyDown(event: KeyboardEvent): void {
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (selectedSample.value) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepEpochInLightbox(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepEpochInLightbox(1);
    } else if (event.key === "Escape") {
      selectedSample.value = null;
    }
  } else if (viewMode.value === "carousel") {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepCarouselEpoch(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepCarouselEpoch(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      stepCarouselPrompt(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      stepCarouselPrompt(1);
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-base-300">
    <!-- Header Toolbar: View Modes, Prompts Info, Live Override, and Pane Sizing -->
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hairline bg-base-200 px-3.5 py-2"
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="text-xs font-semibold text-base-content shrink-0">Preview</span>
        <span
          class="font-mono-num rounded bg-base-300 px-1.5 py-0.5 text-[11px] text-subtle shrink-0"
        >
          {{ items.length }} renders
        </span>
        <span
          v-if="modeNote"
          class="hidden truncate text-[11px] text-muted xl:inline"
          :title="modeNote"
        >
          · {{ modeNote }}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 min-w-0">
        <!-- 3-Way View Switcher: Matrix | Carousel | Stream -->
        <BasePillGroup
          v-model="viewMode"
          :options="[
            {
              value: 'matrix',
              label: 'Matrix',
              icon: Columns,
              title: 'Structured Epoch × Prompt Matrix',
            },
            {
              value: 'carousel',
              label: 'Carousel',
              icon: GalleryHorizontal,
              title:
                'Carousel Spotlight — Clean inspection for multi-prompt batches without scrollbars',
            },
            {
              value: 'chronological',
              label: 'Stream',
              icon: Grid,
              title: 'Chronological Stream (Newest First)',
            },
          ]"
        />

        <!-- Live Prompts Override Drawer Trigger -->
        <BaseButton
          variant="ghost"
          size="compact"
          title="Safely view or override the active run's live sample prompts"
          @click="emit('openOverrideDrawer')"
        >
          <template #icon-left><Sparkles class="h-3.5 w-3.5 text-primary" /></template>
          <span :class="paneMode === 'split' ? 'hidden 2xl:inline' : 'hidden sm:inline'">
            Live Prompts…
          </span>
        </BaseButton>

        <!-- Pane Sizing Controls (Split | 2/3 Wide | Collapse) -->
        <BasePillGroup>
          <button
            type="button"
            class="btn btn-sm h-7.5 border-0 px-2 rounded-md transition cursor-pointer"
            :class="
              paneMode === 'split'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            title="Standard Split View (~50/50 balance with telemetry)"
            @click="emit('setPaneMode', 'split')"
          >
            <Columns2 class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 border-0 px-2 rounded-md transition cursor-pointer"
            :class="
              paneMode === 'wide'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            title="Expand Preview Pane to 2/3 of screen width"
            @click="emit('setPaneMode', 'wide')"
          >
            <PanelRightOpen class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 border-0 btn-ghost text-subtle hover:text-error px-2 rounded-md transition cursor-pointer"
            title="Collapse Preview Pane to focus fully on Telemetry"
            @click="emit('setPaneMode', 'collapsed')"
          >
            <PanelRightClose class="h-3.5 w-3.5" />
          </button>
        </BasePillGroup>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-3 scrollbar-none">
      <!-- Empty State -->
      <div
        v-if="items.length === 0"
        class="flex h-64 flex-col items-center justify-center gap-1.5 text-center text-xs text-muted"
      >
        <p class="font-medium text-base-content">
          {{
            prompts.length > 0
              ? "No preview samples generated for this run yet."
              : "Trainer in standby."
          }}
        </p>
        <p class="text-[12px] text-subtle max-w-sm">
          {{
            prompts.length > 0
              ? "Click Sample Now in the top telemetry bar to trigger an immediate preview after the current step."
              : "No active training preview. Launch a job in Composer to begin generating samples."
          }}
        </p>
      </div>

      <!-- VIEW MODE 1: MATRIX (Structured Epoch × Prompt Table with Prompt Filters) -->
      <div v-else-if="viewMode === 'matrix'" class="space-y-3">
        <!-- Prompt Filter Tabs (Activated when run has > 2 prompts to eliminate horizontal overflow) -->
        <div
          v-if="promptColumns.length > 2"
          class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-hairline/60"
        >
          <span class="text-[11px] font-semibold text-muted uppercase tracking-wider mr-1 shrink-0">
            Prompt Filter:
          </span>
          <button
            type="button"
            class="btn btn-sm h-7.5 rounded-md shrink-0 px-3 text-xs font-semibold cursor-pointer transition"
            :class="
              selectedPromptFilter === 'all'
                ? 'bg-neutral text-neutral-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="selectedPromptFilter = 'all'"
          >
            All Prompts ({{ promptColumns.length }})
          </button>
          <button
            v-for="col in promptColumns"
            :key="col.index"
            type="button"
            class="btn btn-sm h-7.5 rounded-md shrink-0 truncate max-w-50 px-3 text-xs font-semibold cursor-pointer transition"
            :class="
              selectedPromptFilter === col.index
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            :title="col.text"
            @click="selectedPromptFilter = col.index"
          >
            <span class="font-mono-num font-bold mr-1">P{{ col.index + 1 }}:</span>
            <span class="truncate">{{ col.text }}</span>
          </button>
        </div>

        <!-- Sticky Prompt Column Headers (When 'All Prompts' or Wide Mode) -->
        <div
          class="sticky top-0 z-10 grid gap-2.5 border-b border-hairline bg-base-300/95 pb-2 backdrop-blur"
          :style="{
            gridTemplateColumns: `68px repeat(${Math.max(1, visiblePromptColumns.length)}, minmax(${selectedPromptFilter === 'all' && paneMode !== 'wide' ? '140px' : '180px'}, 1fr))`,
          }"
        >
          <div class="flex items-center text-xs font-semibold tracking-wider text-muted uppercase">
            Epoch
          </div>
          <div
            v-for="col in visiblePromptColumns"
            :key="col.index"
            class="truncate rounded border border-hairline bg-base-200 px-3 py-1.5 text-xs text-subtle"
            :title="col.text"
          >
            <strong class="font-mono-num mr-1 text-base-content font-bold">
              P{{ col.index + 1 }}:
            </strong>
            {{ col.text }}
          </div>
        </div>

        <!-- Epoch Rows -->
        <div
          v-for="ep in epochsList"
          :key="ep"
          class="grid items-stretch gap-2.5 rounded-lg border p-2.5 transition-colors"
          :class="
            highlightedEpoch === ep
              ? 'border-primary bg-primary/10'
              : 'border-hairline bg-base-200/70 hover:border-hairline-strong'
          "
          :style="{
            gridTemplateColumns: `68px repeat(${Math.max(1, visiblePromptColumns.length)}, minmax(${selectedPromptFilter === 'all' && paneMode !== 'wide' ? '140px' : '180px'}, 1fr))`,
          }"
        >
          <!-- Epoch Label Cell -->
          <div class="flex flex-col justify-center gap-0.5">
            <span class="font-mono-num text-sm font-bold text-base-content">Ep {{ ep }}</span>
            <span class="text-xs text-muted">
              {{ ep === 0 ? "Baseline" : `Ckpt ${ep}` }}
            </span>
            <button
              type="button"
              class="mt-1 text-[10px] text-primary/80 hover:underline text-left"
              title="Inspect this epoch in Carousel spotlight"
              @click="
                carouselEpoch = ep;
                viewMode = 'carousel';
              "
            >
              Spotlight →
            </button>
          </div>

          <!-- Sample Thumbnail Cells -->
          <div
            v-for="col in visiblePromptColumns"
            :key="col.index"
            class="group relative aspect-square overflow-hidden rounded-md border border-hairline bg-base-100 shadow-xs"
          >
            <template v-if="getCell(ep, col.index)">
              <img
                :src="thumbUrl(getCell(ep, col.index)!.path, 480)"
                :alt="`Epoch ${ep} Prompt ${col.index + 1}`"
                loading="lazy"
                class="h-full w-full cursor-pointer object-cover transition duration-150 group-hover:scale-[1.02]"
                @click="selectedSample = getCell(ep, col.index)!"
              />
              <!-- Bottom overlay strip -->
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/90 via-black/40 to-transparent px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100"
              >
                <span class="font-mono-num font-semibold">Ep {{ ep }} · P{{ col.index + 1 }}</span>
                <span class="flex items-center gap-1"><Eye class="h-3 w-3" /> Inspect</span>
              </div>
            </template>
            <div v-else class="flex h-full w-full items-center justify-center text-xs text-muted">
              —
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW MODE 2: CAROUSEL (Focused Spotlight with Multi-Prompt Filmstrip & Zero Scrollbars) -->
      <div v-else-if="viewMode === 'carousel'" class="flex flex-col gap-3">
        <!-- Carousel Sub-Toolbar: Epoch Stepper & Prompt Selector Pills -->
        <div
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-base-200 px-3 py-2"
        >
          <!-- Epoch Stepper -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-muted uppercase tracking-wider">Epoch:</span>
            <BasePillGroup>
              <button
                type="button"
                class="btn btn-sm h-7.5 border-0 px-2 rounded-md transition cursor-pointer"
                :disabled="epochsList.indexOf(carouselEpoch) >= epochsList.length - 1"
                title="Previous / Older Epoch (←)"
                @click="stepCarouselEpoch(-1)"
              >
                <ChevronLeft class="h-3.5 w-3.5" />
              </button>
              <span
                class="font-mono-num flex items-center bg-base-300 px-3 text-xs font-bold text-base-content"
              >
                Ep {{ carouselEpoch }}
                <span v-if="carouselEpoch === 0" class="ml-1 text-[10px] text-subtle font-normal"
                  >(Base)</span
                >
                <span
                  v-else-if="carouselEpoch === epochsList[0]"
                  class="ml-1 text-[10px] text-success font-normal"
                  >(Latest)</span
                >
              </span>
              <button
                type="button"
                class="btn btn-sm h-7.5 border-0 px-2 rounded-md transition cursor-pointer"
                :disabled="epochsList.indexOf(carouselEpoch) <= 0"
                title="Next / Newer Epoch (→)"
                @click="stepCarouselEpoch(1)"
              >
                <ChevronRight class="h-3.5 w-3.5" />
              </button>
            </BasePillGroup>
          </div>

          <!-- Prompt Switcher Tabs (Handles 1, 2, 4, 8+ prompts effortlessly without scrollbars) -->
          <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              v-for="col in promptColumns"
              :key="col.index"
              type="button"
              class="btn btn-sm h-7.5 rounded-md gap-1.5 px-3 text-xs font-semibold cursor-pointer transition"
              :class="
                carouselPromptIdx === col.index
                  ? 'bg-primary text-primary-content shadow-xs'
                  : 'btn-ghost text-subtle border border-hairline hover:text-base-content'
              "
              :title="col.text"
              @click="carouselPromptIdx = col.index"
            >
              <span class="font-mono-num font-bold">P{{ col.index + 1 }}</span>
              <span class="hidden lg:inline truncate max-w-30">{{ col.text }}</span>
            </button>
          </div>
        </div>

        <!-- Main Carousel Image Stage -->
        <div
          class="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-hairline bg-base-100 p-2 sm:p-4 min-h-105 shadow-sm"
        >
          <template v-if="carouselCurrentSample">
            <div
              class="relative max-h-[64vh] max-w-full overflow-hidden rounded-lg flex items-center justify-center"
            >
              <img
                :src="mediaUrl(carouselCurrentSample.path)"
                :alt="carouselCurrentSample.name"
                class="max-h-[64vh] w-auto max-w-full rounded object-contain cursor-pointer shadow-md"
                @click="selectedSample = carouselCurrentSample"
              />

              <!-- Pinned A/B Crossfade Overlay (if active) -->
              <img
                v-if="
                  carouselComparePinned && carouselComparePinned.path !== carouselCurrentSample.path
                "
                :src="mediaUrl(carouselComparePinned.path)"
                :alt="carouselComparePinned.name"
                class="pointer-events-none absolute inset-0 max-h-[64vh] w-full rounded object-contain"
                :style="{ opacity: carouselCrossfadeAlpha }"
              />

              <!-- Floating Left/Right Stage Chevrons for Prompt Navigation -->
              <button
                v-if="promptColumns.length > 1"
                type="button"
                class="absolute left-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm bg-black/60 hover:bg-black/85 border-0 text-white backdrop-blur shadow-md"
                title="Previous Prompt (↑)"
                @click="stepCarouselPrompt(-1)"
              >
                <ChevronLeft class="h-4 w-4" />
              </button>
              <button
                v-if="promptColumns.length > 1"
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm bg-black/60 hover:bg-black/85 border-0 text-white backdrop-blur shadow-md"
                title="Next Prompt (↓)"
                @click="stepCarouselPrompt(1)"
              >
                <ChevronRight class="h-4 w-4" />
              </button>
            </div>
          </template>
          <div v-else class="flex h-64 flex-col items-center justify-center text-xs text-muted">
            <p>
              No sample rendered for Epoch {{ carouselEpoch }} / Prompt {{ carouselPromptIdx + 1 }}.
            </p>
          </div>
        </div>

        <!-- Carousel Bottom Bar: Prompt Detail, Seed, and A/B Pinning -->
        <div class="flex flex-col gap-2 rounded-lg border border-hairline bg-base-200 p-3 text-xs">
          <!-- Active Prompt Text -->
          <div class="flex items-start justify-between gap-3">
            <p class="text-subtle leading-relaxed flex-1">
              <strong class="text-base-content font-mono-num mr-1">
                P{{ carouselPromptIdx + 1 }}:
              </strong>
              {{
                carouselCurrentSample?.prompt ||
                prompts[carouselPromptIdx] ||
                promptColumns[carouselPromptIdx]?.text ||
                carouselCurrentSample?.name
              }}
            </p>
            <BaseButton
              v-if="carouselCurrentSample"
              size="compact"
              :variant="
                carouselComparePinned?.path === carouselCurrentSample.path ? 'primary' : 'ghost'
              "
              title="Pin this image to crossfade against other epochs"
              @click="
                carouselComparePinned =
                  carouselComparePinned?.path === carouselCurrentSample.path
                    ? null
                    : carouselCurrentSample
              "
            >
              <template #icon-left><Layers class="h-3.5 w-3.5" /></template>
              <span>{{ carouselComparePinned ? "Pinned" : "A/B Pin" }}</span>
            </BaseButton>
          </div>

          <!-- Crossfade Slider (when an image is pinned) -->
          <div
            v-if="
              carouselComparePinned &&
              carouselCurrentSample &&
              carouselComparePinned.path !== carouselCurrentSample.path
            "
            class="flex items-center gap-3 border-t border-hairline pt-2"
          >
            <span class="font-mono-num text-[11px] text-primary shrink-0">
              Current: Ep {{ carouselCurrentSample.epoch }}
            </span>
            <input
              v-model.number="carouselCrossfadeAlpha"
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="range range-xs range-primary flex-1"
            />
            <span class="font-mono-num text-[11px] text-warning shrink-0">
              Pinned: Ep {{ carouselComparePinned.epoch }} ({{
                Math.round(carouselCrossfadeAlpha * 100)
              }}%)
            </span>
          </div>

          <!-- Multi-Prompt Thumbnail Filmstrip (When an epoch has multiple prompts) -->
          <div
            v-if="carouselEpochSamples.length > 1"
            class="flex items-center gap-2 overflow-x-auto scrollbar-none border-t border-hairline pt-2"
          >
            <span class="text-[10px] font-semibold text-muted uppercase tracking-wider shrink-0">
              Prompts in Ep {{ carouselEpoch }}:
            </span>
            <div
              v-for="sample in carouselEpochSamples"
              :key="sample.path"
              class="group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded border transition"
              :class="
                promptIdx(sample) === carouselPromptIdx
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'border-hairline opacity-65 hover:opacity-100'
              "
              @click="carouselPromptIdx = promptIdx(sample)"
            >
              <img
                :src="thumbUrl(sample.path, 120)"
                :alt="`Prompt ${promptIdx(sample) + 1}`"
                class="h-full w-full object-cover"
              />
              <span
                class="font-mono-num absolute bottom-0 inset-x-0 bg-black/80 text-center text-[9px] text-white font-bold"
              >
                P{{ promptIdx(sample) + 1 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW MODE 3: CHRONOLOGICAL STREAM (Flat Responsive Grid) -->
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="item in items"
          :key="item.path"
          class="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-hairline bg-base-200 transition hover:border-primary/60 shadow-xs"
          @click="selectedSample = item"
        >
          <div class="relative aspect-square overflow-hidden bg-base-100">
            <img
              :src="thumbUrl(item.path, 420)"
              :alt="item.name"
              loading="lazy"
              class="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
          </div>
          <div class="flex flex-col gap-0.5 p-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-mono-num font-semibold text-base-content">
                Epoch {{ item.epoch }} · P{{ promptIdx(item) + 1 }}
              </span>
              <span v-if="item.seed" class="font-mono-num text-[10px] text-muted">
                #{{ item.seed }}
              </span>
            </div>
            <p class="line-clamp-2 text-[11px] text-subtle">
              {{ item.prompt || prompts[promptIdx(item)] || item.name }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox & A/B Epoch Crossfade Modal -->
    <div
      v-if="selectedSample"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-xs"
      @click.self="selectedSample = null"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-hairline-strong bg-base-300 shadow-2xl"
      >
        <!-- Modal Header -->
        <div
          class="flex items-center justify-between border-b border-hairline bg-base-200 px-4 py-2.5 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono-num text-sm font-semibold text-base-content mr-1">
              Epoch {{ selectedSample.epoch }} · Prompt {{ promptIdx(selectedSample) + 1 }}
            </span>
            <BaseButton size="compact" variant="ghost" @click="stepEpochInLightbox(-1)">
              ← Prev Epoch
            </BaseButton>
            <BaseButton size="compact" variant="ghost" @click="stepEpochInLightbox(1)">
              Next Epoch →
            </BaseButton>
          </div>

          <div class="flex items-center gap-2">
            <BaseButton
              size="compact"
              :variant="comparePinned?.path === selectedSample.path ? 'primary' : 'ghost'"
              @click="
                comparePinned = comparePinned?.path === selectedSample.path ? null : selectedSample
              "
            >
              <template #icon-left><Layers class="h-3.5 w-3.5" /></template>
              {{
                comparePinned
                  ? `Pinned Ep ${comparePinned.epoch} (Click to clear)`
                  : "Pin for A/B Crossfade"
              }}
            </BaseButton>

            <BaseButton size="compact" variant="ghost" @click="selectedSample = null">
              Close (Esc)
            </BaseButton>
          </div>
        </div>

        <!-- Modal Image Stage -->
        <div
          class="relative flex flex-1 items-center justify-center overflow-hidden bg-base-100 p-4"
        >
          <div class="relative max-h-[70vh] max-w-full">
            <img
              :src="mediaUrl(selectedSample.path)"
              :alt="selectedSample.name"
              class="max-h-[70vh] w-auto rounded object-contain"
            />
            <img
              v-if="comparePinned && comparePinned.path !== selectedSample.path"
              :src="mediaUrl(comparePinned.path)"
              :alt="comparePinned.name"
              class="pointer-events-none absolute inset-0 max-h-[70vh] w-full rounded object-contain"
              :style="{ opacity: crossfadeAlpha }"
            />
          </div>
        </div>

        <!-- Crossfade Bar & Prompt Footer -->
        <div class="flex flex-col gap-2 border-t border-hairline bg-base-200 px-4 py-3 text-xs">
          <div
            v-if="comparePinned && comparePinned.path !== selectedSample.path"
            class="flex items-center gap-3"
          >
            <span class="font-mono-num text-primary">Current: Ep {{ selectedSample.epoch }}</span>
            <input
              v-model.number="crossfadeAlpha"
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="range range-xs range-primary flex-1"
            />
            <span class="font-mono-num text-warning">
              Pinned: Ep {{ comparePinned.epoch }} ({{ Math.round(crossfadeAlpha * 100) }}%)
            </span>
          </div>

          <p class="text-subtle">
            <strong class="text-base-content">Prompt:</strong>
            {{ selectedSample.prompt || prompts[promptIdx(selectedSample)] || selectedSample.name }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
