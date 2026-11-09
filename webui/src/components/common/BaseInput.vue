<script setup lang="ts">
import { computed } from "vue";

export type InputSize =
  | "default" // 38.25px (h-8.5 rounded-lg) - Primary form and search standard
  | "compact" // 34px (h-8 rounded-md) - Utility rows & compact panels
  | "xs"; // 28px (h-7 rounded-md) - Step controls & tight inline numbers

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    type?: string;
    size?: InputSize;
    placeholder?: string;
    disabled?: boolean;
    mono?: boolean;
    error?: boolean;
    inputClass?: string;
  }>(),
  {
    type: "text",
    size: "default",
    placeholder: "",
    disabled: false,
    mono: false,
    error: false,
    inputClass: "",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
  (e: "keydown", event: KeyboardEvent): void;
  (e: "keyup", event: KeyboardEvent): void;
  (e: "blur", event: FocusEvent): void;
  (e: "focus", event: FocusEvent): void;
}>();

const sizeClasses = computed(() => {
  switch (props.size) {
    case "compact":
      return "input-sm h-8 rounded-md text-xs";
    case "xs":
      return "input-xs h-7 rounded-md text-xs";
    case "default":
    default:
      return "input-sm h-8.5 rounded-lg text-xs";
  }
});

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}

function handleChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit("change", target.value);
}
</script>

<template>
  <div class="relative flex items-center w-full">
    <div
      v-if="$slots.prefix"
      class="pointer-events-none absolute left-2.5 flex items-center text-subtle z-1"
    >
      <slot name="prefix" />
    </div>

    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="input w-full border-hairline-strong bg-base-100 transition focus:border-primary focus:outline-none disabled:opacity-50"
      :class="[
        sizeClasses,
        mono ? 'font-mono' : 'font-sans',
        error ? 'border-error/80 focus:border-error' : '',
        $slots.prefix ? 'pl-8.5' : '',
        $slots.suffix ? 'pr-8.5' : '',
        inputClass,
      ]"
      @input="handleInput"
      @change="handleChange"
      @keydown="emit('keydown', $event)"
      @keyup="emit('keyup', $event)"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
    />

    <div
      v-if="$slots.suffix"
      class="pointer-events-none absolute right-2.5 flex items-center text-subtle z-1 [&>*]:pointer-events-auto"
    >
      <slot name="suffix" />
    </div>
  </div>
</template>
