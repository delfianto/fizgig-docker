<script setup lang="ts">
import { computed } from "vue";

export type ToggleSize = "default" | "compact" | "large";
export type ToggleVariant = "primary" | "success" | "warning" | "info";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean | string | number;
    size?: ToggleSize;
    variant?: ToggleVariant;
    disabled?: boolean;
    label?: string;
    description?: string;
    labelPosition?: "left" | "right";
    title?: string;
    id?: string;
    name?: string;
  }>(),
  {
    modelValue: false,
    size: "default",
    variant: "primary",
    disabled: false,
    label: undefined,
    description: undefined,
    labelPosition: "right",
    title: undefined,
    id: undefined,
    name: undefined,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "change", value: boolean): void;
}>();

const isChecked = computed(() => {
  const val = props.modelValue;
  if (typeof val === "boolean") return val;
  if (val === "true" || val === "1" || val === 1) return true;
  return false;
});

function toggle(): void {
  if (props.disabled) return;
  const next = !isChecked.value;
  emit("update:modelValue", next);
  emit("change", next);
}

const trackSizeClass = computed(() => {
  switch (props.size) {
    case "compact":
      return "h-4.5 w-8 p-0.5";
    case "large":
      return "h-6.5 w-12 p-0.5";
    case "default":
    default:
      return "h-5.5 w-10 p-0.5";
  }
});

const thumbSizeClass = computed(() => {
  switch (props.size) {
    case "compact":
      return "h-3 w-3";
    case "large":
      return "h-5 w-5";
    case "default":
    default:
      return "h-4 w-4";
  }
});

const thumbTranslateClass = computed(() => {
  if (!isChecked.value) {
    return "translate-x-0";
  }
  switch (props.size) {
    case "compact":
      return "translate-x-3.5";
    case "large":
      return "translate-x-5.5";
    case "default":
    default:
      return "translate-x-4.5";
  }
});

const activeTrackBgClass = computed(() => {
  switch (props.variant) {
    case "success":
      return "bg-success border-success text-success-content";
    case "warning":
      return "bg-warning border-warning text-warning-content";
    case "info":
      return "bg-info border-info text-info-content";
    case "primary":
    default:
      return "bg-primary border-primary text-primary-content";
  }
});
</script>

<template>
  <div
    class="inline-flex items-center gap-2.5"
    :class="[
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      labelPosition === 'left' ? 'flex-row-reverse justify-between w-full' : '',
    ]"
    :title="title"
  >
    <!-- Accessible Interactive Switch -->
    <button
      :id="id"
      :name="name"
      type="button"
      role="switch"
      :aria-checked="isChecked"
      :disabled="disabled"
      class="group relative inline-flex shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 disabled:cursor-not-allowed select-none"
      :class="[
        trackSizeClass,
        isChecked
          ? `${activeTrackBgClass} shadow-xs`
          : 'bg-base-300 border-hairline-strong hover:border-primary/50 text-base-content/60',
      ]"
      @click="toggle"
      @keydown.space.prevent="toggle"
      @keydown.enter.prevent="toggle"
    >
      <span
        aria-hidden="true"
        class="pointer-events-none inline-block rounded-full shadow-md transition-all duration-200 ease-in-out"
        :class="[
          thumbSizeClass,
          thumbTranslateClass,
          isChecked ? 'bg-white shadow-xs' : 'bg-subtle group-hover:bg-white shadow-xs',
        ]"
      >
        <slot name="thumb" :checked="isChecked" />
      </span>
    </button>

    <!-- Optional Label & Description -->
    <div
      v-if="label || $slots.default || description || $slots.description"
      class="flex flex-col select-none min-w-0"
      :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
      @click="toggle"
    >
      <span class="text-xs font-medium text-base-content leading-snug truncate">
        <slot>{{ label }}</slot>
      </span>
      <span
        v-if="description || $slots.description"
        class="text-[11px] text-muted leading-tight truncate"
      >
        <slot name="description">{{ description }}</slot>
      </span>
    </div>
  </div>
</template>
