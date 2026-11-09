<script setup lang="ts">
import { computed, ref } from "vue";
import { HelpCircle, Info, RotateCcw } from "lucide-vue-next";
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
    class="flex flex-col justify-between h-full gap-1.5"
    :class="{ 'opacity-50 pointer-events-none': isDisabled }"
  >
    <div class="flex items-center justify-between gap-2">
      <label
        class="flex cursor-pointer items-center gap-2 text-xs font-medium text-base-content select-none"
      >
        <input
          type="checkbox"
          class="toggle toggle-xs toggle-primary shrink-0"
          :checked="Boolean(currentValue)"
          :disabled="isDisabled"
          @change="updateValue(($event.target as HTMLInputElement).checked)"
        />
        <span class="leading-snug">{{ row.label }}</span>
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

        <button
          v-if="row.hint"
          type="button"
          class="text-muted hover:text-base-content"
          :title="row.hint"
          @click="showHintPopover = !showHintPopover"
        >
          <HelpCircle class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <p
      v-if="(systemStore.explainMode || showHintPopover) && row.hint"
      class="text-[11px] leading-relaxed text-muted pt-0.5"
    >
      {{ row.hint }}
    </p>
    <p v-if="dynamicNote" class="text-[11px] leading-relaxed text-warning pt-0.5">
      {{ dynamicNote }}
    </p>
  </div>

  <!-- Standard Label + Input/Select/Radio Control -->
  <div
    v-else
    class="flex flex-col justify-between h-full gap-1.5"
    :class="{ 'opacity-50 pointer-events-none': isDisabled }"
  >
    <div class="flex items-center justify-between gap-1.5">
      <label class="flex items-center gap-1.5 text-xs font-semibold text-subtle">
        <span>{{ row.label || row.key }}</span>
        <span v-if="row.suffix" class="font-mono text-[10px] text-muted"> ({{ row.suffix }}) </span>
      </label>

      <div class="flex items-center gap-1">
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

        <button
          v-if="row.hint"
          type="button"
          class="text-muted hover:text-base-content"
          :title="row.hint"
          @click="showHintPopover = !showHintPopover"
        >
          <HelpCircle class="h-3.5 w-3.5" />
        </button>
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

    <!-- Optional Hint / Live Note -->
    <p
      v-if="(systemStore.explainMode || showHintPopover) && row.hint"
      class="text-[11px] leading-relaxed text-muted pt-0.5"
    >
      {{ row.hint }}
    </p>
    <p
      v-if="dynamicNote"
      class="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] leading-snug text-warning pt-0.5"
    >
      {{ dynamicNote }}
    </p>
  </div>
</template>
