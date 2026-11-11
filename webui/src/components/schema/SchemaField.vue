<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { ChevronDown, HelpCircle, Info, Lightbulb, RotateCcw } from "lucide-vue-next";
import { type SchemaRow } from "@shared/types";
import { BaseButton, BaseInput, BaseSelect, BaseToggle } from "@/components/common";
import { formatDecimal } from "@/utils";
import { useComposerStore } from "@/stores/composer";
import { useSystemStore } from "@/stores/system";

const props = defineProps<{
  row: SchemaRow;
  compact?: boolean;
}>();

const composerStore = useComposerStore();
const systemStore = useSystemStore();

const showInfoPopover = ref(false);
const showComboMenu = ref(false);
const infoContainerRef = ref<HTMLElement | null>(null);
const comboContainerRef = ref<HTMLElement | null>(null);

onClickOutside(infoContainerRef, () => {
  showInfoPopover.value = false;
});

onClickOutside(comboContainerRef, () => {
  showComboMenu.value = false;
});

function handleEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    showInfoPopover.value = false;
    showComboMenu.value = false;
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleEscape);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscape);
});

const currentValue = computed(() => {
  const val = composerStore.draftValues[props.row.key];
  return val !== undefined ? val : (props.row.default ?? "");
});

function resolveMatchingChoice(val: unknown, choices?: string[]): string {
  if (!choices || choices.length === 0) return String(val ?? "");
  const strVal = String(val ?? "").trim();

  if (choices.includes(strVal)) return strVal;

  const lower = strVal.toLowerCase();
  const caseMatch = choices.find((ch) => ch.toLowerCase() === lower);
  if (caseMatch !== undefined) return caseMatch;

  const numVal = Number(strVal);
  if (!Number.isNaN(numVal) && strVal !== "") {
    const numMatch = choices.find((ch) => {
      const chNum = Number(ch);
      return !Number.isNaN(chNum) && chNum === numVal;
    });
    if (numMatch !== undefined) return numMatch;
  }

  return strVal || choices[0] || "";
}

function formatDecimalValue(val: unknown): string {
  return formatDecimal(val, "");
}

const selectedChoice = computed(() => {
  return resolveMatchingChoice(currentValue.value, props.row.choices);
});

const isModified = computed(() => {
  if (composerStore.modifiedKeys.has(props.row.key)) return true;
  if (props.row.parts) {
    return props.row.parts.some((p) => p.key && composerStore.modifiedKeys.has(p.key));
  }
  return false;
});

const isDisabled = computed(() => composerStore.formState.disabled?.includes(props.row.key));

const dynamicNote = computed(() => composerStore.formState.notes?.[props.row.key] ?? "");

const hasRecommendation = computed(() => Boolean(dynamicNote.value));

const isCheckboxChecked = computed(() => {
  const val = currentValue.value;
  if (typeof val === "boolean") return val;
  if (val === "true" || val === "1" || val === 1) return true;
  return false;
});

const isNumericLike = computed(() => {
  if (typeof props.row.default === "number") return true;
  const k = props.row.key;
  return (
    k.includes("DIM") ||
    k.includes("ALPHA") ||
    k.includes("EPOCHS") ||
    k.includes("LR") ||
    k.includes("RATE") ||
    k.includes("SEED") ||
    k.includes("STEPS") ||
    k.includes("BATCH") ||
    k.includes("ACCUM") ||
    k.includes("NORM") ||
    k.includes("STRENGTH") ||
    k.includes("FACTOR") ||
    k.includes("CFG") ||
    k.includes("WIDTH") ||
    k.includes("HEIGHT") ||
    k.includes("MEGAPIXELS") ||
    k.includes("TIMESTEP") ||
    k.includes("STATES")
  );
});

function updateValue(val: unknown): void {
  composerStore.setFieldValue(props.row.key, val);
}

function resetRowAndParts(): void {
  composerStore.resetField(props.row.key);
  if (props.row.parts) {
    for (const part of props.row.parts) {
      if (part.key) {
        composerStore.resetField(part.key);
      }
    }
  }
}

// --- Cadence multi-part helpers (e.g. SAVE_EVERY_N_EPOCHS + SAVE_LATER, SAVE_UNTIL_EPOCH, SAVE_EVERY_AFTER) ---
const cadenceLaterPart = computed(() => props.row.parts?.[0] ?? null);
const cadenceUntilPart = computed(() => props.row.parts?.[1] ?? null);
const cadenceAfterPart = computed(() => props.row.parts?.[2] ?? null);

const isCadenceSplitEnabled = computed(() => {
  const part = cadenceLaterPart.value;
  if (!part) return false;
  const v = composerStore.draftValues[part.key] ?? part.default ?? false;
  return v === true || v === "true" || v === 1 || v === "1";
});

function toggleCadenceSplit(enabled: boolean): void {
  const part = cadenceLaterPart.value;
  if (!part) return;
  composerStore.setFieldValue(part.key, enabled);
  if (enabled && props.row.tick_fills) {
    for (const [fillKey, fillVal] of Object.entries(props.row.tick_fills)) {
      if (
        composerStore.draftValues[fillKey] === props.row.default ||
        composerStore.draftValues[fillKey] === undefined
      ) {
        composerStore.setFieldValue(fillKey, fillVal);
      }
    }
  }
}

// --- Blocks (TRAINING_BLOCKS) interactive helpers ---
const blocksDict = computed<Record<string, boolean>>(() => {
  const raw = currentValue.value;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, boolean>;
  }
  return {};
});

const allBlockIds = computed<string[]>(() => {
  const ids: string[] = [];
  for (const grp of props.row.groups ?? []) {
    for (const b of grp.blocks) {
      ids.push(b.id);
    }
  }
  return ids;
});

function isBlockActive(id: string): boolean {
  return Boolean(blocksDict.value[id]);
}

function toggleBlockId(id: string): void {
  const next = { ...blocksDict.value, [id]: !blocksDict.value[id] };
  updateValue(next);
}

function setAllBlocks(on: boolean): void {
  if (!on) {
    updateValue({});
    return;
  }
  const next: Record<string, boolean> = {};
  for (const id of allBlockIds.value) {
    next[id] = true;
  }
  updateValue(next);
}

function applyBlockArea(blockIds: string[]): void {
  const next: Record<string, boolean> = {};
  for (const id of blockIds) {
    next[id] = true;
  }
  updateValue(next);
}

const activeBlocksCount = computed(() => {
  return allBlockIds.value.filter((id) => Boolean(blocksDict.value[id])).length;
});

function shortenToggleLabel(row: SchemaRow): string {
  const overrides: Record<string, string> = {
    TRAIN_SUBFOLDERS: "Train Sub-folders",
    ADAPTIVE_LR: "Adaptive LR",
    KREA2_LOSS_WATCH: "Per-Image Loss Tracking",
    KREA2_PER_IMAGE_LR: "Per-Image Adaptive LR",
    KREA2_WARMUP_LOOK: "Warm-Up Look Outliers",
    KREA2_AUTO_RECAPTION: "Auto-Recaption Stuck",
    FAMILY_FT_FUSED: "Fused Backward Gradients",
    SAVE_STATE: "Save Checkpoint State",
    SAVE_STATE_ON_TRAIN_END: "Save Final State",
    ENABLE_BUCKET: "Enable Bucketing",
    BUCKET_NO_UPSCALE: "No Upscale (Native Size)",
    ENABLE_CACHE: "Pre-Cache Latents",
    MASKED_TRAINING: "Masked Training",
    FAMILY_MP_MANUAL: "Raw Captions As-Is",
    FAMILY_MP_FACECROPS_FIRST: "Face Crops First",
    FAMILY_SUBJECT_FIX: "Fix Subject Triggers",
    FAMILY_CONCEPT_BALANCE: "Balance Subjects",
    SAMPLE_ENABLED: "Live Previews",
    __SAMPLE_LIVE: "Live Run Overrides",
    SAMPLE_AT_FIRST: "Preview Before Start",
    SAMPLE_CHECKPOINT: "Distilled Sample Model",
    H3_TREAD: "TREAD Token Routing",
    H3_CLIP_STILL: "Train Clip Still Frame",
    H3_DISTILL: "Reference Distillation",
    H3_TRAIN_REFINER: "Train Text Refiner",
    FAMILY_SLIDER_ULTRA: "Ultra Mode",
    FAMILY_FAST_ID: "Fast Identity Mode",
    FAMILY_TRAINING_ADAPTER: "Training Adapter",
    SAMPLE_STRENGTHS: "Preview at 0.5× Strength",
    MOSS_LORA_SFT: "Train Attention Only",
    FAMILY_PREVIEW_LOOK: "Base Previews SFT Look",
    FAMILY_TURBO_ON: "Turbo LoRA Previews",
  };
  if (overrides[row.key]) return overrides[row.key];

  let lbl = row.label || row.key;
  const parenIdx = lbl.indexOf("(");
  if (parenIdx > 0) {
    lbl = lbl.substring(0, parenIdx).trim();
  }
  const dashIdx = lbl.indexOf("—");
  if (dashIdx > 0) {
    lbl = lbl.substring(0, dashIdx).trim();
  }
  if (lbl.startsWith("Also ")) {
    lbl = lbl.substring(5).trim();
  }
  return lbl;
}

const displayToggleLabel = computed(() => shortenToggleLabel(props.row));
</script>

<template>
  <!-- Advisory Section Note / Callout -->
  <div v-if="row.kind === 'note'" class="flex items-start gap-2.5 text-xs text-base-content">
    <Info class="h-4 w-4 text-info shrink-0 mt-0.5" />
    <div class="space-y-0.5 min-w-0">
      <div v-if="row.label" class="font-medium text-base-content leading-relaxed">
        {{ row.label }}
      </div>
      <div v-if="row.hint" class="text-[11px] text-muted leading-relaxed">
        {{ row.hint }}
      </div>
    </div>
  </div>

  <!-- Toggle Switch -->
  <div
    v-else-if="row.kind === 'check'"
    class="relative flex items-center justify-between gap-2.5 w-full select-none"
    :class="{ 'opacity-50 pointer-events-none': isDisabled }"
  >
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <BaseToggle
        :model-value="isCheckboxChecked"
        :disabled="isDisabled"
        :size="compact ? 'compact' : 'default'"
        @update:model-value="updateValue($event)"
      />
      <span
        class="text-xs font-semibold text-base-content leading-snug truncate cursor-pointer select-none"
        :title="row.label"
        @click="!isDisabled && updateValue(!isCheckboxChecked)"
      >
        {{ displayToggleLabel }}
      </span>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <button
        v-if="isModified"
        type="button"
        class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-primary-content transition cursor-pointer"
        :title="`Modified from preset (${composerStore.baselineValues[row.key]}). Click to reset.`"
        @click="resetRowAndParts"
      >
        <RotateCcw class="h-3 w-3" />
      </button>

      <!-- Unified Info & Tip Popover Button -->
      <div ref="infoContainerRef" class="relative inline-block">
        <button
          type="button"
          class="group relative flex h-6 w-6 items-center justify-center rounded-md transition cursor-pointer select-none"
          :class="[
            showInfoPopover
              ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
              : hasRecommendation
                ? 'text-warning hover:bg-warning/15 hover:text-warning'
                : 'text-muted hover:bg-base-300 hover:text-base-content',
          ]"
          :title="dynamicNote || row.hint || 'Parameter details'"
          @click.stop="showInfoPopover = !showInfoPopover"
        >
          <HelpCircle class="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          <span
            v-if="hasRecommendation"
            class="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-base-100"
          />
        </button>

        <div
          v-if="showInfoPopover"
          class="absolute right-0 top-full z-40 mt-1.5 w-72 sm:w-80 rounded-xl border border-hairline bg-base-300 p-3.5 text-[11px] leading-relaxed text-base-content shadow-xl select-text space-y-2.5"
          @click.stop
        >
          <div class="flex items-center justify-between pb-1.5 border-b border-hairline">
            <span
              class="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-base-content"
            >
              <HelpCircle
                class="h-3.5 w-3.5"
                :class="hasRecommendation ? 'text-warning' : 'text-primary'"
              />
              <span class="truncate">{{ displayToggleLabel }}</span>
            </span>
            <button
              type="button"
              class="flex h-4 w-4 items-center justify-center rounded text-muted hover:bg-base-200 hover:text-base-content text-[11px] font-mono cursor-pointer transition-colors"
              @click="showInfoPopover = false"
            >
              ✕
            </button>
          </div>

          <div
            v-if="dynamicNote"
            class="rounded-md border border-warning/30 bg-warning/10 p-2 space-y-1"
          >
            <div
              class="flex items-center gap-1 font-bold text-warning text-[10px] uppercase tracking-wider"
            >
              <Lightbulb class="h-3 w-3 shrink-0" />
              <span>Live Recommendation</span>
            </div>
            <p class="text-xs text-base-content leading-relaxed">{{ dynamicNote }}</p>
          </div>

          <div
            v-if="row.label && row.label !== displayToggleLabel"
            class="rounded-md border border-hairline/80 bg-base-200/60 p-2 space-y-0.5"
          >
            <div class="font-bold text-[10px] uppercase tracking-wider text-muted">
              Full Parameter Name
            </div>
            <p class="text-xs font-medium text-base-content leading-snug">{{ row.label }}</p>
          </div>

          <div v-if="row.hint" class="space-y-1">
            <div
              v-if="dynamicNote || row.label !== displayToggleLabel"
              class="font-bold text-[10px] uppercase tracking-wider text-muted"
            >
              Parameter Guide
            </div>
            <p class="text-subtle text-[11px] whitespace-pre-line leading-relaxed">
              {{ row.hint }}
            </p>
          </div>

          <div v-else-if="!dynamicNote" class="space-y-1 text-[11px] text-subtle leading-relaxed">
            <p>Standard execution flag for {{ composerStore.family }}.</p>
            <div class="font-mono text-[10px] text-muted space-y-0.5 pt-1 border-t border-hairline">
              <div>Key: <span class="text-base-content">{{ row.key }}</span></div>
              <div>
                Default:
                <span class="text-base-content">{{ String(row.default ?? "false") }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Standard Label + Input / Select / Editable Combo / Cadence / Split / Blocks / Shown Control -->
  <div
    v-else
    class="relative flex flex-col justify-between h-full gap-1.5"
    :class="{ 'opacity-50 pointer-events-none': isDisabled }"
  >
    <div class="flex items-center justify-between gap-1.5">
      <label class="flex items-center gap-1.5 text-xs font-semibold text-subtle truncate">
        <span class="truncate">{{ row.label || row.key }}</span>
        <span v-if="row.suffix" class="font-mono text-[10px] text-muted shrink-0">
          ({{ row.suffix }})
        </span>
      </label>

      <div class="flex shrink-0 items-center gap-1">
        <BaseButton
          v-if="isModified"
          size="xs"
          variant="bare"
          class="h-5 px-1.5 py-0 text-[10px] text-primary bg-primary/15 hover:bg-primary hover:text-primary-content"
          :title="`Preset default: ${formatDecimalValue(composerStore.baselineValues[row.key])}. Click to reset.`"
          @click="resetRowAndParts"
        >
          <template #icon-left>
            <RotateCcw class="h-2.5 w-2.5" />
          </template>
          <span>Reset</span>
        </BaseButton>

        <!-- Unified Info & Tip Popover Button -->
        <div ref="infoContainerRef" class="relative inline-block">
          <button
            type="button"
            class="group relative flex h-5 w-5 items-center justify-center rounded transition cursor-pointer select-none"
            :class="[
              showInfoPopover
                ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                : hasRecommendation
                  ? 'text-warning hover:bg-warning/15 hover:text-warning'
                  : 'text-muted hover:bg-base-300 hover:text-base-content',
            ]"
            :title="dynamicNote || row.hint || 'Parameter details'"
            @click.stop="showInfoPopover = !showInfoPopover"
          >
            <HelpCircle class="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            <span
              v-if="hasRecommendation"
              class="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-base-100"
            />
          </button>

          <div
            v-if="showInfoPopover"
            class="absolute right-0 top-full z-40 mt-1.5 w-68 sm:w-76 rounded-lg border border-hairline bg-base-300 p-3 text-[11px] leading-relaxed text-base-content shadow-xl select-text space-y-2.5"
            @click.stop
          >
            <div class="flex items-center justify-between pb-1.5 border-b border-hairline">
              <span
                class="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-base-content"
              >
                <HelpCircle
                  class="h-3.5 w-3.5"
                  :class="hasRecommendation ? 'text-warning' : 'text-primary'"
                />
                <span class="truncate">{{ row.label || row.key }}</span>
              </span>
              <button
                type="button"
                class="flex h-4 w-4 items-center justify-center rounded text-muted hover:bg-base-200 hover:text-base-content text-[11px] font-mono cursor-pointer transition-colors"
                @click="showInfoPopover = false"
              >
                ✕
              </button>
            </div>

            <div
              v-if="dynamicNote"
              class="rounded-md border border-warning/30 bg-warning/10 p-2 space-y-1"
            >
              <div
                class="flex items-center gap-1 font-bold text-warning text-[10px] uppercase tracking-wider"
              >
                <Lightbulb class="h-3 w-3 shrink-0" />
                <span>Live Recommendation</span>
              </div>
              <p class="text-xs text-base-content leading-relaxed">{{ dynamicNote }}</p>
            </div>

            <div v-if="row.hint || row.slide_hint" class="space-y-1">
              <div
                v-if="dynamicNote"
                class="font-bold text-[10px] uppercase tracking-wider text-muted"
              >
                Parameter Guide
              </div>
              <p
                v-if="row.hint"
                class="text-subtle text-[11px] whitespace-pre-line leading-relaxed"
              >
                {{ row.hint }}
              </p>
              <p
                v-if="row.slide_hint"
                class="text-muted text-[11px] whitespace-pre-line leading-relaxed pt-1 border-t border-hairline/60"
              >
                {{ row.slide_hint }}
              </p>
            </div>

            <div v-else-if="!dynamicNote" class="space-y-1 text-[11px] text-subtle leading-relaxed">
              <p>Standard hyperparameter for {{ composerStore.family }}.</p>
              <div
                class="font-mono text-[10px] text-muted space-y-0.5 pt-1 border-t border-hairline"
              >
                <div>Key: <span class="text-base-content">{{ row.key }}</span></div>
                <div>
                  Default:
                  <span class="text-base-content">{{ String(row.default ?? "none") }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 1. Editable Combobox (Preset Choices + Custom Free-Text Value) -->
    <template v-if="row.kind === 'combo' && row.choices && row.choices.length > 0">
      <div ref="comboContainerRef" class="relative w-full">
        <BaseInput
          :model-value="isNumericLike ? formatDecimalValue(currentValue) : String(currentValue)"
          :placeholder="
            composerStore.formState.placeholders?.[row.key] || formatDecimalValue(row.default) || ''
          "
          :mono="isNumericLike"
          @update:model-value="updateValue($event)"
        >
          <template #suffix>
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-base-200 hover:text-base-content cursor-pointer transition"
              title="Pick from common preset values"
              @click.stop="showComboMenu = !showComboMenu"
            >
              <ChevronDown class="h-3.5 w-3.5" />
            </button>
          </template>
        </BaseInput>

        <div
          v-if="showComboMenu"
          class="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-hairline-strong bg-base-300 p-1 shadow-xl"
        >
          <button
            v-for="ch in row.choices"
            :key="ch"
            type="button"
            class="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition cursor-pointer"
            :class="[
              selectedChoice === ch
                ? 'bg-primary/20 text-primary font-bold'
                : 'text-base-content hover:bg-surface-hover',
              isNumericLike ? 'font-mono' : 'font-sans',
            ]"
            @click="
              updateValue(ch);
              showComboMenu = false;
            "
          >
            <span>{{ row.labels?.[ch] ?? (isNumericLike ? formatDecimalValue(ch) : ch) }}</span>
            <span v-if="selectedChoice === ch" class="text-[10px] font-mono">Selected</span>
          </button>
        </div>
      </div>
    </template>

    <!-- 2. Strict Choice / Radio -->
    <template
      v-else-if="
        (row.kind === 'choice' || row.kind === 'radio') && row.choices && row.choices.length > 0
      "
    >
      <div
        v-if="row.kind === 'radio' && row.choices.length <= 3"
        class="join flex w-full rounded-lg border border-hairline-strong bg-base-100 p-0.5 h-8.5 items-center"
      >
        <BaseButton
          v-for="ch in row.choices"
          :key="ch"
          size="pill"
          :active="selectedChoice === ch"
          class="flex-1"
          @click="updateValue(ch)"
        >
          {{ row.labels?.[ch] ?? (isNumericLike ? formatDecimalValue(ch) : ch) }}
        </BaseButton>
      </div>

      <BaseSelect
        v-else
        :model-value="selectedChoice"
        :mono="isNumericLike"
        :options="
          row.choices.map((ch) => ({
            value: ch,
            label: row.labels?.[ch] ?? (isNumericLike ? formatDecimalValue(ch) : ch),
          }))
        "
        @update:model-value="updateValue($event)"
      />
    </template>

    <!-- 3. Cadence Row (e.g. Every N epochs, optionally changing rate after epoch M) -->
    <template v-else-if="row.kind === 'cadence'">
      <div
        class="flex flex-wrap items-center gap-2.5 rounded-lg border border-hairline bg-base-100/60 p-2 text-xs"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-subtle">Every</span>
          <div class="w-18">
            <BaseInput
              :model-value="formatDecimalValue(currentValue)"
              size="xs"
              mono
              input-class="text-center font-semibold"
              @update:model-value="updateValue($event)"
            />
          </div>
          <span class="text-subtle">epoch(s)</span>
        </div>

        <template v-if="cadenceLaterPart">
          <div class="h-4 w-px bg-hairline hidden sm:block" />
          <BaseToggle
            :model-value="isCadenceSplitEnabled"
            size="compact"
            label="Change rate later"
            @update:model-value="toggleCadenceSplit"
          />
        </template>

        <template v-if="isCadenceSplitEnabled && cadenceUntilPart && cadenceAfterPart">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-subtle">up to epoch</span>
            <div class="w-18">
              <BaseInput
                :model-value="
                  formatDecimalValue(
                    composerStore.draftValues[cadenceUntilPart.key] ?? cadenceUntilPart.default,
                  )
                "
                size="xs"
                mono
                input-class="text-center font-semibold"
                @update:model-value="composerStore.setFieldValue(cadenceUntilPart.key, $event)"
              />
            </div>
            <span class="text-subtle">then every</span>
            <div class="w-18">
              <BaseInput
                :model-value="
                  formatDecimalValue(
                    composerStore.draftValues[cadenceAfterPart.key] ?? cadenceAfterPart.default,
                  )
                "
                size="xs"
                mono
                input-class="text-center font-semibold"
                @update:model-value="composerStore.setFieldValue(cadenceAfterPart.key, $event)"
              />
            </div>
            <span class="text-subtle">epoch(s)</span>
          </div>
        </template>
      </div>
    </template>

    <!-- 4. Split / Slide Schedule Row (e.g. MOSS_LOWNOISE_PCT) -->
    <template v-else-if="row.kind === 'split'">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1">
          <BaseButton
            size="xs"
            :variant="String(currentValue) === '' ? 'primary' : 'ghost'"
            :active="String(currentValue) === ''"
            @click="updateValue('')"
          >
            Auto
          </BaseButton>
          <BaseButton
            v-if="row.single"
            size="xs"
            :variant="String(currentValue) === row.single ? 'primary' : 'ghost'"
            :active="String(currentValue) === row.single"
            @click="updateValue(row.single)"
          >
            Fixed ({{ row.single }}%)
          </BaseButton>
          <BaseButton
            v-if="typeof row.default === 'string' && row.default.includes(':')"
            size="xs"
            :variant="String(currentValue) === row.default ? 'primary' : 'ghost'"
            :active="String(currentValue) === row.default"
            @click="updateValue(row.default)"
          >
            Slide ({{ row.default }})
          </BaseButton>
        </div>

        <div class="flex-1 min-w-48">
          <BaseInput
            :model-value="String(currentValue)"
            placeholder="Empty = model default (or e.g. 30:7:60:8:3)"
            mono
            @update:model-value="updateValue($event)"
          />
        </div>
      </div>
    </template>

    <!-- 5. Interactive Transformer Block Picker (TRAINING_BLOCKS when Model Area = Custom) -->
    <template v-else-if="row.kind === 'blocks'">
      <div class="rounded-lg border border-hairline bg-base-100/70 p-3 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <BaseButton size="xs" variant="ghost" @click="setAllBlocks(true)">All</BaseButton>
            <BaseButton size="xs" variant="ghost" @click="setAllBlocks(false)">None</BaseButton>
            <template v-if="row.areas">
              <div class="h-3.5 w-px bg-hairline mx-0.5" />
              <BaseButton
                v-for="(areaBlocks, areaName) in row.areas"
                :key="areaName"
                size="xs"
                variant="outline"
                @click="applyBlockArea(areaBlocks)"
              >
                {{ areaName }}
              </BaseButton>
            </template>
          </div>
          <span class="badge badge-xs badge-neutral font-mono">
            {{ activeBlocksCount }} / {{ allBlockIds.length }} blocks selected
          </span>
        </div>

        <div v-if="row.groups && row.groups.length > 0" class="space-y-2">
          <div v-for="grp in row.groups" :key="grp.label" class="space-y-1">
            <div class="text-[10px] font-bold uppercase tracking-wider text-muted">
              {{ grp.label }} Blocks
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="blk in grp.blocks"
                :key="blk.id"
                type="button"
                class="h-6 min-w-7 rounded border px-1.5 font-mono text-[11px] font-semibold transition cursor-pointer"
                :class="
                  isBlockActive(blk.id)
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-hairline bg-base-200/70 text-muted hover:text-base-content'
                "
                @click="toggleBlockId(blk.id)"
              >
                {{ blk.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 6. Read-Only Shown Status /Synced Folder Row -->
    <template v-else-if="row.kind === 'shown'">
      <div
        class="flex h-8.5 items-center justify-between rounded-lg border border-hairline bg-base-100/60 px-3 font-mono text-xs text-subtle"
      >
        <span class="truncate">
          {{
            row.sets_training_folder
              ? composerStore.imageFolder || "Select dataset folder in Essential Studio"
              : String(currentValue || dynamicNote || "—")
          }}
        </span>
        <span class="badge badge-xs badge-neutral shrink-0">Synced</span>
      </div>
    </template>

    <!-- 7. Multi-line Textarea -->
    <template v-else-if="row.kind === 'text'">
      <textarea
        :value="String(currentValue)"
        :rows="row.lines || 3"
        class="textarea textarea-bordered w-full rounded-lg border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed text-base-content focus:border-primary focus:outline-none"
        @input="updateValue(($event.target as HTMLTextAreaElement).value)"
      />
    </template>

    <!-- 8. Standard Entry / Folder / Path -->
    <template v-else>
      <BaseInput
        :model-value="isNumericLike ? formatDecimalValue(currentValue) : String(currentValue)"
        :placeholder="
          composerStore.formState.placeholders?.[row.key] || formatDecimalValue(row.default) || ''
        "
        :mono="isNumericLike || row.kind === 'folder' || row.kind === 'path'"
        @update:model-value="updateValue($event)"
      />
    </template>

    <!-- Inline Hint only when Explain Mode is globally activated -->
    <p
      v-if="systemStore.explainMode && row.hint"
      class="text-[11px] leading-relaxed text-muted pt-0.5"
    >
      {{ row.hint }}
    </p>
  </div>
</template>
