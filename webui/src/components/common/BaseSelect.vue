<script setup lang="ts" generic="T extends string | number">
import { computed } from "vue";

export interface SelectOption<V extends string | number = string | number> {
  value: V;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: T;
    options?: Array<SelectOption<T>>;
    size?: "default" | "compact";
    disabled?: boolean;
    mono?: boolean;
    selectClass?: string;
  }>(),
  {
    options: () => [],
    size: "default",
    disabled: false,
    mono: false,
    selectClass: "",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: T): void;
  (e: "change", value: T): void;
}>();

const sizeClasses = computed(() => {
  return props.size === "compact"
    ? "select-sm h-8 rounded-md text-xs"
    : "select-sm h-8.5 rounded-lg text-xs";
});

function handleChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  const val = target.value as unknown as T;
  emit("update:modelValue", val);
  emit("change", val);
}
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    class="select border-hairline-strong bg-base-100 transition focus:border-primary focus:outline-none disabled:opacity-50"
    :class="[sizeClasses, mono ? 'font-mono' : 'font-sans', selectClass]"
    @change="handleChange"
  >
    <slot>
      <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">
        {{ opt.label }}
      </option>
    </slot>
  </select>
</template>
