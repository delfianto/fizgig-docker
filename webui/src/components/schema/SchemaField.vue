<script setup lang="ts">
import { computed, ref } from "vue";
import { HelpCircle, Info, Lightbulb, RotateCcw } from "lucide-vue-next";
import { type SchemaRow } from "@shared/types";
import { useComposerStore } from "@/stores/composer";
import { useSystemStore } from "@/stores/system";

const props = defineProps<{
  row: SchemaRow;
  compact?: boolean;
}>();

const composerStore = useComposerStore();
const systemStore = useSystemStore();
const showInfoPopover = ref(false);

const currentValue = computed(() => {
  const val = composerStore.draftValues[props.row.key];
  return val !== undefined ? val : (props.row.default ?? "");
});

function resolveMatchingChoice(val: unknown, choices?: string[]): string {
  if (!choices || choices.length === 0) return String(val ?? "");
  const strVal = String(val ?? "").trim();

  // 1. Exact string match
  if (choices.includes(strVal)) return strVal;

  // 2. Case-insensitive match
  const lower = strVal.toLowerCase();
  const caseMatch = choices.find((ch) => ch.toLowerCase() === lower);
  if (caseMatch !== undefined) return caseMatch;

  // 3. Numeric match (e.g. 0.0001 <-> 1e-4, 1 <-> 1.0, 30 <-> "30")
  const numVal = Number(strVal);
  if (!Number.isNaN(numVal) && strVal !== "") {
    const numMatch = choices.find((ch) => {
      const chNum = Number(ch);
      return !Number.isNaN(chNum) && chNum === numVal;
    });
    if (numMatch !== undefined) return numMatch;
  }

  // 4. Fallback to raw value or first choice
  return strVal || choices[0] || "";
}

function formatDecimalValue(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).trim();
  if (/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(str)) {
    const num = Number(str);
    if (!Number.isNaN(num)) {
      return num.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 8 });
    }
  }
  return str;
}

const selectedChoice = computed(() => {
  return resolveMatchingChoice(currentValue.value, props.row.choices);
});

const isModified = computed(() => composerStore.modifiedKeys.has(props.row.key));

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
    k.includes("STATES")
  );
});

function updateValue(val: unknown): void {
  composerStore.setFieldValue(props.row.key, val);
}
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

  <!-- Toggle Checkbox -->
  <div
    v-else-if="row.kind === 'check'"
    class="relative flex flex-col justify-between h-full gap-1.5"
    :class="{ 'opacity-50 pointer-events-none': isDisabled }"
  >
    <div class="flex items-center justify-between gap-2">
      <label
        class="flex cursor-pointer items-center gap-2 text-xs font-medium text-base-content select-none min-w-0"
      >
        <input
          type="checkbox"
          class="toggle toggle-xs toggle-primary shrink-0"
          :checked="isCheckboxChecked"
          :disabled="isDisabled"
          @change="updateValue(($event.target as HTMLInputElement).checked)"
        />
        <span class="leading-snug truncate">{{ row.label }}</span>
      </label>

      <div class="flex shrink-0 items-center gap-1">
        <button
          v-if="isModified"
          type="button"
          class="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-primary-content"
          :title="`Modified from preset (${composerStore.baselineValues[row.key]}). Click to reset.`"
          @click="composerStore.resetField(row.key)"
        >
          <RotateCcw class="h-2.5 w-2.5" />
        </button>

        <!-- Unified Info & Tip Popover Button -->
        <div class="relative inline-block">
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

            <div v-if="row.hint" class="space-y-1">
              <div
                v-if="dynamicNote"
                class="font-bold text-[10px] uppercase tracking-wider text-muted"
              >
                Parameter Guide
              </div>
              <p class="text-subtle text-[11px] whitespace-pre-line leading-relaxed">
                {{ row.hint }}
              </p>
            </div>

            <div v-else-if="!dynamicNote" class="space-y-1 text-[11px] text-subtle leading-relaxed">
              <p>Standard hyperparameter for {{ composerStore.family }}.</p>
              <div
                class="font-mono text-[10px] text-muted space-y-0.5 pt-1 border-t border-hairline"
              >
                <div>
                  Key: <span class="text-base-content">{{ row.key }}</span>
                </div>
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

    <!-- Inline Hint only when Explain Mode is globally activated -->
    <p
      v-if="systemStore.explainMode && row.hint"
      class="text-[11px] leading-relaxed text-muted pt-0.5"
    >
      {{ row.hint }}
    </p>
  </div>

  <!-- Standard Label + Input/Select/Radio Control -->
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
        <button
          v-if="isModified"
          type="button"
          class="flex items-center gap-0.5 rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary hover:bg-primary hover:text-primary-content"
          :title="`Preset default: ${formatDecimalValue(composerStore.baselineValues[row.key])}. Click to reset.`"
          @click="composerStore.resetField(row.key)"
        >
          <RotateCcw class="h-2.5 w-2.5" />
          <span>Reset</span>
        </button>

        <!-- Unified Info & Tip Popover Button -->
        <div class="relative inline-block">
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

            <div v-if="row.hint" class="space-y-1">
              <div
                v-if="dynamicNote"
                class="font-bold text-[10px] uppercase tracking-wider text-muted"
              >
                Parameter Guide
              </div>
              <p class="text-subtle text-[11px] whitespace-pre-line leading-relaxed">
                {{ row.hint }}
              </p>
            </div>

            <div v-else-if="!dynamicNote" class="space-y-1 text-[11px] text-subtle leading-relaxed">
              <p>Standard hyperparameter for {{ composerStore.family }}.</p>
              <div
                class="font-mono text-[10px] text-muted space-y-0.5 pt-1 border-t border-hairline"
              >
                <div>
                  Key: <span class="text-base-content">{{ row.key }}</span>
                </div>
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

    <!-- Choice / Combo / Radio -->
    <template
      v-if="
        (row.kind === 'choice' || row.kind === 'combo' || row.kind === 'radio') &&
        row.choices &&
        row.choices.length > 0
      "
    >
      <!-- Segmented Pills for <= 3 short options in radio mode -->
      <div
        v-if="row.kind === 'radio' && row.choices.length <= 3"
        class="join flex w-full rounded-md border border-hairline-strong bg-base-100 p-0.5"
      >
        <button
          v-for="ch in row.choices"
          :key="ch"
          type="button"
          class="btn btn-xs join-item flex-1 border-0"
          :class="
            selectedChoice === ch
              ? 'bg-primary text-primary-content font-bold'
              : 'btn-ghost text-subtle'
          "
          @click="updateValue(ch)"
        >
          {{ row.labels?.[ch] ?? (isNumericLike ? formatDecimalValue(ch) : ch) }}
        </button>
      </div>

      <!-- Compact Select -->
      <select
        v-else
        :value="selectedChoice"
        class="select select-sm w-full border-hairline-strong bg-base-100 text-xs text-base-content focus:border-primary focus:outline-none"
        :class="{ 'font-mono-num': isNumericLike }"
        @change="updateValue(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="ch in row.choices" :key="ch" :value="ch">
          {{ row.labels?.[ch] ?? (isNumericLike ? formatDecimalValue(ch) : ch) }}
        </option>
        <option
          v-if="selectedChoice && !row.choices.includes(selectedChoice)"
          :value="selectedChoice"
        >
          {{ isNumericLike ? formatDecimalValue(selectedChoice) : selectedChoice }}
        </option>
      </select>
    </template>

    <!-- Blocks to train (e.g. TRAINING_BLOCKS) -->
    <template v-else-if="row.kind === 'blocks'">
      <div class="rounded border border-hairline bg-base-100/70 p-2 text-xs text-subtle space-y-1">
        <div class="flex items-center justify-between font-mono text-[11px]">
          <span>Block Selection</span>
          <span class="badge badge-xs badge-neutral">Managed by Area</span>
        </div>
        <p class="text-[10px] text-muted">
          Blocks train according to the selected Model Area (Full Model, Identity, Style, Details).
        </p>
      </div>
    </template>

    <!-- Multi-line Textarea -->
    <template v-else-if="row.kind === 'text'">
      <textarea
        :value="String(currentValue)"
        :rows="row.lines || 3"
        class="textarea textarea-bordered w-full border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed text-base-content focus:border-primary focus:outline-none"
        @input="updateValue(($event.target as HTMLTextAreaElement).value)"
      />
    </template>

    <!-- Standard Entry / Folder / Path / Cadence -->
    <template v-else>
      <input
        type="text"
        :value="isNumericLike ? formatDecimalValue(currentValue) : String(currentValue)"
        :placeholder="
          composerStore.formState.placeholders?.[row.key] || formatDecimalValue(row.default) || ''
        "
        class="input input-sm w-full border-hairline-strong bg-base-100 text-xs text-base-content focus:border-primary focus:outline-none"
        :class="{
          'font-mono-num': isNumericLike || row.kind === 'folder' || row.kind === 'path',
        }"
        @input="updateValue(($event.target as HTMLInputElement).value)"
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
