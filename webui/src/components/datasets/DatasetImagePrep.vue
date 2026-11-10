<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw, Scissors } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { apiGet, apiPost } from "@/api/client";
import {
  BaseBadge,
  BaseButton,
  BaseCard,
  BaseInput,
  BaseSelect,
  BaseToggle,
} from "@/components/common";

const props = defineProps<{
  selectedFolder: string;
}>();

const emit = defineEmits<{
  (e: "refresh-datasets"): void;
}>();

interface PrepOptionsResponse {
  modes: string[];
  megapixels: Array<string | number>;
  faces: string[];
  face_tools: boolean;
}

interface PrepSummaryResponse {
  count?: number;
  clips?: number;
  lines?: string[];
  warn?: string;
}

interface PrepStatusResponse {
  running?: boolean;
  done?: number;
  total?: number;
  note?: string;
  error?: string;
}

const prepInputFolder = ref(props.selectedFolder);
const modes = ref<string[]>([
  "Auto Prep (Face Crops)",
  "Resize Only",
  "Face Crop Only",
  "Detail Crops (Style)",
]);
const megapixelsList = ref<string[]>(["0.25", "0.5", "0.75", "1.0", "1.5", "2.0"]);
const faceTargets = ref<string[]>(["Largest Face", "Largest Male Face", "Largest Female Face"]);
const faceToolsAvailable = ref<boolean>(false);

const selectedMode = ref<string>("Auto Prep (Face Crops)");
const selectedMp = ref<string>("1.0");
const selectedFace = ref<string>("Largest Face");
const facePadding = ref<number>(20);
const replaceInPlace = ref<boolean>(false);
const cropsOnly = ref<boolean>(false);

const prepSummary = ref<PrepSummaryResponse | null>(null);
const loadingSummary = ref<boolean>(false);
const prepStatus = ref<PrepStatusResponse | null>(null);
const confirmRun = ref<boolean>(false);
const startingPrep = ref<boolean>(false);

let statusPollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchPrepOptions(): Promise<void> {
  try {
    const res = await apiGet<PrepOptionsResponse>("/api/prep/options");
    if (Array.isArray(res.modes) && res.modes.length > 0) {
      modes.value = res.modes;
      if (!modes.value.includes(selectedMode.value)) {
        selectedMode.value = modes.value[0]!;
      }
    }
    if (Array.isArray(res.megapixels) && res.megapixels.length > 0) {
      megapixelsList.value = res.megapixels.map(String);
    }
    if (Array.isArray(res.faces) && res.faces.length > 0) {
      faceTargets.value = res.faces;
    }
    faceToolsAvailable.value = Boolean(res.face_tools);
  } catch {
    // Keep sensible defaults if options call fails
  }
}

async function fetchPrepSummary(): Promise<void> {
  const folder = prepInputFolder.value.trim() || props.selectedFolder;
  if (!folder) return;
  loadingSummary.value = true;
  try {
    prepSummary.value = await apiGet<PrepSummaryResponse>("/api/prep/summary", {
      folder,
      mode: selectedMode.value,
      mp: selectedMp.value,
      replace: replaceInPlace.value ? 1 : 0,
      crops_only: cropsOnly.value ? 1 : 0,
    });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to inspect dataset summary");
  } finally {
    loadingSummary.value = false;
  }
}

async function pollPrepStatus(): Promise<void> {
  try {
    const st = await apiGet<PrepStatusResponse>("/api/prep/status", { since: 0 });
    const wasRunning = Boolean(prepStatus.value?.running);
    prepStatus.value = st;
    if (wasRunning && !st.running) {
      if (st.error) {
        toast.error(st.error);
      } else {
        toast.success("Dataset image preparation completed");
        emit("refresh-datasets");
        void fetchPrepSummary();
      }
      stopStatusPolling();
    }
  } catch {
    // Ignore transient status hiccups
  }
}

function startStatusPolling(): void {
  if (statusPollTimer) return;
  statusPollTimer = setInterval(() => {
    void pollPrepStatus();
  }, 1500);
}

function stopStatusPolling(): void {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

async function runImagePrep(): Promise<void> {
  const folder = prepInputFolder.value.trim() || props.selectedFolder;
  if (!folder) return;
  startingPrep.value = true;
  confirmRun.value = false;
  try {
    await apiPost("/api/prep/run", {
      folder,
      mode: selectedMode.value,
      mp: Number(selectedMp.value) || 1.0,
      face: selectedFace.value,
      padding: facePadding.value,
      replace: replaceInPlace.value,
      crops_only: cropsOnly.value,
    });
    toast.success("Started dataset image preparation");
    await pollPrepStatus();
    startStatusPolling();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to start image preparation");
  } finally {
    startingPrep.value = false;
  }
}

watch(
  () => props.selectedFolder,
  (folder) => {
    if (folder) {
      prepInputFolder.value = folder;
      void fetchPrepSummary();
    }
  },
);

watch([selectedMode, selectedMp, replaceInPlace, cropsOnly], () => {
  void fetchPrepSummary();
});

onMounted(async () => {
  await fetchPrepOptions();
  await Promise.all([fetchPrepSummary(), pollPrepStatus()]);
  if (prepStatus.value?.running) {
    startStatusPolling();
  }
});

onUnmounted(() => {
  stopStatusPolling();
});
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl space-y-4">
      <BaseCard
        title="Dataset Aspect-Ratio &amp; Image Prep Studio"
        subtitle="Preview aspect-ratio resizing, face close-up generation, and safe archival of originals before modifying files."
      >
        <template #icon>
          <Scissors class="h-4 w-4 text-primary" />
        </template>
        <template #actions>
          <BaseBadge :variant="faceToolsAvailable ? 'success' : 'neutral'" mono>
            {{ faceToolsAvailable ? "Face Detector Ready" : "Standard Resize" }}
          </BaseBadge>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-semibold text-subtle">
                Target Dataset Folder
              </label>
              <BaseInput v-model="prepInputFolder" mono @change="fetchPrepSummary" />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Target Area (MP)</label>
              <BaseSelect
                :model-value="selectedMp"
                mono
                class="w-full"
                :options="megapixelsList.map((m) => ({ value: m, label: `${m} MP` }))"
                @update:model-value="selectedMp = String($event)"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Prep Mode</label>
              <BaseSelect
                :model-value="selectedMode"
                class="w-full"
                :options="modes.map((m) => ({ value: m, label: m }))"
                @update:model-value="selectedMode = String($event)"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Face Target</label>
              <BaseSelect
                :model-value="selectedFace"
                class="w-full"
                :disabled="!faceToolsAvailable"
                :options="faceTargets.map((f) => ({ value: f, label: f }))"
                @update:model-value="selectedFace = String($event)"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-subtle">Face Padding (%)</label>
              <BaseInput
                :model-value="facePadding"
                type="number"
                mono
                :disabled="!faceToolsAvailable"
                @update:model-value="facePadding = Math.max(0, Math.min(100, Number($event) || 0))"
              />
            </div>
          </div>

          <div
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-base-300/50 px-3.5 py-2.5"
          >
            <div class="flex flex-wrap items-center gap-5">
              <BaseToggle
                v-model="cropsOnly"
                size="compact"
                label="Add crops only (keep full photos untouched)"
              />
              <BaseToggle
                v-model="replaceInPlace"
                size="compact"
                variant="warning"
                label="Overwrite originals in-place (skip originals/ backup)"
              />
            </div>

            <BaseButton
              size="compact"
              variant="ghost"
              :disabled="loadingSummary"
              @click="fetchPrepSummary"
            >
              <template #icon-left><RefreshCw class="h-3.5 w-3.5" /></template>
              <span>Refresh Plan</span>
            </BaseButton>
          </div>
        </div>
      </BaseCard>

      <!-- Structured Plan Preview Card ("What Will Happen") -->
      <BaseCard v-if="prepSummary" title="Execution Plan Preview" elevated>
        <template #actions>
          <div class="flex items-center gap-1.5">
            <BaseBadge variant="primary" size="sm" mono>
              {{ prepSummary.count ?? 0 }} images
            </BaseBadge>
            <BaseBadge v-if="prepSummary.clips" variant="info" size="sm" mono>
              {{ prepSummary.clips }} clips
            </BaseBadge>
          </div>
        </template>

        <div class="space-y-3 text-xs">
          <div
            v-if="prepSummary.warn"
            class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning"
          >
            <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" />
            <span>{{ prepSummary.warn }}</span>
          </div>

          <ul v-if="prepSummary.lines && prepSummary.lines.length > 0" class="space-y-2">
            <li
              v-for="(line, idx) in prepSummary.lines"
              :key="idx"
              class="flex items-start gap-2 rounded-lg border border-hairline bg-base-200/80 p-3 text-subtle leading-relaxed"
            >
              <CheckCircle2 class="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span>{{ line }}</span>
            </li>
          </ul>

          <!-- Active Progress Bar -->
          <div
            v-if="prepStatus?.running"
            class="space-y-2 rounded-lg border border-primary/30 bg-primary/10 p-3"
          >
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="flex items-center gap-2 text-primary font-semibold">
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
                {{ prepStatus.note || "Preparing dataset images..." }}
              </span>
              <span v-if="prepStatus.total" class="text-base-content">
                {{ prepStatus.done ?? 0 }} / {{ prepStatus.total }}
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-base-100">
              <div
                class="h-full bg-primary transition-all duration-300"
                :style="{
                  width: prepStatus.total
                    ? `${Math.min(100, Math.round(((prepStatus.done ?? 0) / prepStatus.total) * 100))}%`
                    : '35%',
                }"
              />
            </div>
          </div>

          <!-- Two-Step Safe Execution Controls -->
          <div class="flex items-center justify-end gap-2 border-t border-hairline pt-3">
            <template v-if="!confirmRun">
              <BaseButton
                variant="primary"
                :disabled="Boolean(prepStatus?.running) || startingPrep || !prepSummary.count"
                @click="confirmRun = true"
              >
                <template #icon-left><Play class="h-3.5 w-3.5 fill-current" /></template>
                <span>Run Image Prep</span>
              </BaseButton>
            </template>
            <template v-else>
              <span class="text-xs text-warning font-medium mr-1">
                Proceed with {{ selectedMode }} on {{ prepSummary.count ?? 0 }} images?
              </span>
              <BaseButton variant="ghost" size="compact" @click="confirmRun = false">
                Cancel
              </BaseButton>
              <BaseButton
                variant="primary"
                size="compact"
                :disabled="startingPrep"
                @click="runImagePrep"
              >
                Confirm &amp; Start
              </BaseButton>
            </template>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
