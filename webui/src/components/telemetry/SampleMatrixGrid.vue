<script setup lang="ts">
import { computed, ref } from "vue";
import { Columns, Eye, Grid, Layers, Sparkles } from "lucide-vue-next";
import { type SampleItem } from "@shared/types";
import { mediaUrl, thumbUrl } from "@/api/client";

const props = defineProps<{
  items: SampleItem[];
  prompts: string[];
  highlightedEpoch: number | null;
  modeNote?: string;
}>();

const emit = defineEmits<{
  openOverrideDrawer: [];
}>();

const viewMode = ref<"matrix" | "chronological">("matrix");
const selectedSample = ref<SampleItem | null>(null);
const comparePinned = ref<SampleItem | null>(null);
const crossfadeAlpha = ref<number>(0.5);

function promptIdx(item?: SampleItem | null): number {
  if (!item) return 0;
  return item.prompt_index ?? item.idx ?? 0;
}

// Group samples by epoch (descending) and prompt index (ascending)
const epochsList = computed(() => {
  const epSet = new Set<number>();
  for (const item of props.items) {
    epSet.add(item.epoch ?? 0);
  }
  return [...epSet].toSorted((a, b) => b - a);
});

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
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Matrix Header Toolbar -->
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hairline bg-base-200 px-3.5 py-2"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-base-content"> Sample Previews </span>
        <span class="font-mono-num rounded bg-base-300 px-1.5 py-0.5 text-[11px] text-subtle">
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

      <div class="flex items-center gap-1.5">
        <div class="join border border-hairline bg-base-300 p-0.5 rounded-md">
          <button
            type="button"
            class="btn btn-xs join-item border-0"
            :class="
              viewMode === 'matrix' ? 'bg-primary text-primary-content' : 'btn-ghost text-subtle'
            "
            title="Structured Epoch × Prompt Matrix"
            @click="viewMode = 'matrix'"
          >
            <Columns class="h-3 w-3" />
            Matrix
          </button>
          <button
            type="button"
            class="btn btn-xs join-item border-0"
            :class="
              viewMode === 'chronological'
                ? 'bg-primary text-primary-content'
                : 'btn-ghost text-subtle'
            "
            title="Chronological Stream (Newest First)"
            @click="viewMode = 'chronological'"
          >
            <Grid class="h-3 w-3" />
            Stream
          </button>
        </div>

        <button
          type="button"
          class="btn btn-xs btn-ghost border border-hairline bg-base-300 hover:border-primary/50"
          title="Safely view or override the active run's live sample prompts"
          @click="emit('openOverrideDrawer')"
        >
          <Sparkles class="h-3 w-3 text-primary" />
          <span>Live Prompts…</span>
        </button>
      </div>
    </div>

    <!-- Main Scrollable Matrix / Grid Body -->
    <div class="flex-1 overflow-auto p-3">
      <div
        v-if="items.length === 0"
        class="flex h-64 flex-col items-center justify-center gap-1 text-center text-xs text-muted"
      >
        <p>No preview samples generated for this run yet.</p>
        <p class="text-[11px]">
          Click <strong class="text-base-content">Sample Now</strong> in the top bar to trigger an
          immediate preview after the current step.
        </p>
      </div>

      <!-- MODE 1: Structured Epoch × Prompt Matrix -->
      <div v-else-if="viewMode === 'matrix'" class="space-y-2.5">
        <!-- Sticky Prompt Column Headers -->
        <div
          class="sticky top-0 z-10 grid gap-2.5 border-b border-hairline bg-base-100/95 pb-2 backdrop-blur"
          :style="{
            gridTemplateColumns: `68px repeat(${Math.max(1, promptColumns.length)}, minmax(160px, 1fr))`,
          }"
        >
          <div class="flex items-center text-xs font-semibold tracking-wider text-muted uppercase">
            Epoch
          </div>
          <div
            v-for="col in promptColumns"
            :key="col.index"
            class="truncate rounded border border-hairline bg-base-300 px-3 py-1.5 text-xs text-subtle"
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
              : 'border-hairline bg-base-300/60 hover:border-hairline-strong'
          "
          :style="{
            gridTemplateColumns: `76px repeat(${Math.max(1, promptColumns.length)}, minmax(180px, 1fr))`,
          }"
        >
          <!-- Epoch Label Cell -->
          <div class="flex flex-col justify-center gap-0.5">
            <span class="font-mono-num text-sm font-bold text-base-content"> Ep {{ ep }} </span>
            <span class="text-xs text-muted">
              {{ ep === 0 ? "Baseline" : `Checkpoint ${ep}` }}
            </span>
          </div>

          <!-- Sample Thumbnail Cells -->
          <div
            v-for="col in promptColumns"
            :key="col.index"
            class="group relative aspect-square overflow-hidden rounded-md border border-hairline bg-base-100"
          >
            <template v-if="getCell(ep, col.index)">
              <img
                :src="thumbUrl(getCell(ep, col.index)!.path, 420)"
                :alt="`Epoch ${ep} Prompt ${col.index + 1}`"
                loading="lazy"
                class="h-full w-full cursor-pointer object-cover transition duration-150 group-hover:scale-[1.02]"
                @click="selectedSample = getCell(ep, col.index)!"
              />
              <!-- Bottom overlay strip -->
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
              >
                <span class="font-mono-num"> Ep {{ ep }} · P{{ col.index + 1 }} </span>
                <span class="flex items-center gap-1"> <Eye class="h-3 w-3" /> Inspect </span>
              </div>
            </template>
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-[11px] text-muted"
            >
              —
            </div>
          </div>
        </div>
      </div>

      <!-- MODE 2: Chronological Flat Grid -->
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="item in items"
          :key="item.path"
          class="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-hairline bg-base-300 transition hover:border-primary/60"
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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-xs"
      @click.self="selectedSample = null"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-hairline-strong bg-base-300 shadow-2xl"
      >
        <!-- Modal Header -->
        <div
          class="flex items-center justify-between border-b border-hairline bg-base-200 px-4 py-2.5 text-xs"
        >
          <div class="flex items-center gap-3">
            <span class="font-mono-num text-sm font-semibold text-base-content">
              Epoch {{ selectedSample.epoch }} · Prompt
              {{ promptIdx(selectedSample) + 1 }}
            </span>
            <button
              type="button"
              class="btn btn-xs btn-ghost border border-hairline"
              @click="stepEpochInLightbox(-1)"
            >
              ← Prev Epoch
            </button>
            <button
              type="button"
              class="btn btn-xs btn-ghost border border-hairline"
              @click="stepEpochInLightbox(1)"
            >
              Next Epoch →
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-xs"
              :class="
                comparePinned?.path === selectedSample.path
                  ? 'btn-primary'
                  : 'btn-ghost border border-hairline'
              "
              @click="
                comparePinned = comparePinned?.path === selectedSample.path ? null : selectedSample
              "
            >
              <Layers class="h-3.5 w-3.5" />
              {{
                comparePinned
                  ? `Pinned Ep ${comparePinned.epoch} (Click to clear)`
                  : "Pin for A/B Crossfade"
              }}
            </button>

            <button type="button" class="btn btn-xs btn-ghost" @click="selectedSample = null">
              Close (Esc)
            </button>
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
            <span class="font-mono-num text-primary"> Current: Ep {{ selectedSample.epoch }} </span>
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
