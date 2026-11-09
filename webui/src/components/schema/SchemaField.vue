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
const showHintPopover = ref(false);
const showNotePopover = ref(false);

const currentValue = computed(() => {
  const val = composerStore.draftValues[props.row.key];
  return val !== undefined ? val : (props.row.default ?? "");
});

const isModified = computed(() => composerStore.modifiedKeys.has(props.row.key));

const isDisabled = computed(() => composerStore.formState.disabled?.includes(props.row.key));

const dynamicNote = computed(() => composerStore.formState.notes?.[props.row.key] ?? "");

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
          :checked="Boolean(currentValue)"
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

        <!-- Floating Tip Popover Button -->
        <div v-if="dynamicNote" class="relative inline-block">
          <button
            type="button"
            class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition cursor-pointer select-none"
            :class="
              showNotePopover
                ? 'bg-warning text-warning-content shadow-xs ring-1 ring-warning'
                : 'bg-warning/15 text-warning hover:bg-warning/25'
            "
            :title="dynamicNote"
            @click.stop="showNotePopover = !showNotePopover"
          >
            <Lightbulb class="h-3 w-3 shrink-0" />
            <span>Tip</span>
          </button>

          <div
            v-if="showNotePopover"
            class="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-lg border border-warning/40 bg-base-300 p-2.5 text-[11px] leading-relaxed text-base-content shadow-xl select-text"
            @click.stop
          >
            <div
              class="flex items-center justify-between gap-1 pb-1 border-b border-hairline mb-1.5"
            >
              <span
                class="flex items-center gap-1 font-bold text-warning text-[10px] uppercase tracking-wider"
              >
                <Lightbulb class="h-3 w-3 shrink-0" />
                Recommendation
              </span>
              <button
                type="button"
                class="text-muted hover:text-base-content text-[10px] font-mono px-1 py-0.5 rounded hover:bg-base-200 cursor-pointer"
                @click="showNotePopover = false"
              >
                ✕
              </button>
            </div>
            <p class="text-subtle text-[11px]">{{ dynamicNote }}</p>
          </div>
        </div>

        <!-- Floating Hint Popover Button -->
        <div v-if="row.hint" class="relative inline-block">
          <button
            type="button"
            class="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-base-300 hover:text-base-content transition cursor-pointer"
            :class="{ 'text-primary bg-primary/10': showHintPopover }"
            :title="row.hint"
            @click.stop="showHintPopover = !showHintPopover"
          >
            <HelpCircle class="h-3.5 w-3.5" />
          </button>

          <div
            v-if="showHintPopover"
            class="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-lg border border-hairline bg-base-300 p-2.5 text-[11px] leading-relaxed text-base-content shadow-xl select-text"
            @click.stop
          >
            <div
              class="flex items-center justify-between gap-1 pb-1 border-b border-hairline mb-1.5"
            >
              <span class="font-bold text-base-content text-[10px] uppercase tracking-wider">
                Parameter Info
              </span>
              <button
                type="button"
                class="text-muted hover:text-base-content text-[10px] font-mono px-1 py-0.5 rounded hover:bg-base-200 cursor-pointer"
                @click="showHintPopover = false"
              >
                ✕
              </button>
            </div>
            <p class="text-subtle text-[11px]">{{ row.hint }}</p>
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
          :title="`Preset default: ${composerStore.baselineValues[row.key]}. Click to reset.`"
          @click="composerStore.resetField(row.key)"
        >
          <RotateCcw class="h-2.5 w-2.5" />
          <span>Reset</span>
        </button>

        <!-- Floating Tip Popover Button -->
        <div v-if="dynamicNote" class="relative inline-block">
          <button
            type="button"
            class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition cursor-pointer select-none"
            :class="
              showNotePopover
                ? 'bg-warning text-warning-content shadow-xs ring-1 ring-warning'
                : 'bg-warning/15 text-warning hover:bg-warning/25'
            "
            :title="dynamicNote"
            @click.stop="showNotePopover = !showNotePopover"
          >
            <Lightbulb class="h-3 w-3 shrink-0" />
            <span>Tip</span>
          </button>

          <div
            v-if="showNotePopover"
            class="absolute right-0 top-full z-40 mt-1.5 w-64 sm:w-72 rounded-lg border border-warning/40 bg-base-300 p-2.5 text-[11px] leading-relaxed text-base-content shadow-xl select-text"
            @click.stop
          >
            <div
              class="flex items-center justify-between gap-1 pb-1 border-b border-hairline mb-1.5"
            >
              <span
                class="flex items-center gap-1 font-bold text-warning text-[10px] uppercase tracking-wider"
              >
                <Lightbulb class="h-3 w-3 shrink-0" />
                Recommendation
              </span>
              <button
                type="button"
                class="text-muted hover:text-base-content text-[10px] font-mono px-1 py-0.5 rounded hover:bg-base-200 cursor-pointer"
                @click="showNotePopover = false"
              >
                ✕
              </button>
            </div>
            <p class="text-subtle text-[11px]">{{ dynamicNote }}</p>
          </div>
        </div>

        <!-- Floating Hint Popover Button -->
        <div v-if="row.hint" class="relative inline-block">
          <button
            type="button"
            class="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-base-300 hover:text-base-content transition cursor-pointer"
            :class="{ 'text-primary bg-primary/10': showHintPopover }"
            :title="row.hint"
            @click.stop="showHintPopover = !showHintPopover"
          >
            <HelpCircle class="h-3.5 w-3.5" />
          </button>

          <div
            v-if="showHintPopover"
            class="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-lg border border-hairline bg-base-300 p-2.5 text-[11px] leading-relaxed text-base-content shadow-xl select-text"
            @click.stop
          >
            <div
              class="flex items-center justify-between gap-1 pb-1 border-b border-hairline mb-1.5"
            >
              <span class="font-bold text-base-content text-[10px] uppercase tracking-wider">
                Parameter Info
              </span>
              <button
                type="button"
                class="text-muted hover:text-base-content text-[10px] font-mono px-1 py-0.5 rounded hover:bg-base-200 cursor-pointer"
                @click="showHintPopover = false"
              >
                ✕
              </button>
            </div>
            <p class="text-subtle text-[11px]">{{ row.hint }}</p>
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
            String(currentValue) === ch
              ? 'bg-primary text-primary-content font-bold'
              : 'btn-ghost text-subtle'
          "
          @click="updateValue(ch)"
        >
          {{ row.labels?.[ch] ?? ch }}
        </button>
      </div>

      <!-- Compact Select -->
      <select
        v-else
        :value="String(currentValue)"
        class="select select-sm w-full border-hairline-strong bg-base-100 text-xs text-base-content focus:border-primary focus:outline-none"
        :class="{ 'font-mono-num': isNumericLike }"
        @change="updateValue(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="ch in row.choices" :key="ch" :value="ch">
          {{ row.labels?.[ch] ?? ch }}
        </option>
      </select>
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
        :value="String(currentValue)"
        :placeholder="composerStore.formState.placeholders?.[row.key] || String(row.default ?? '')"
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
