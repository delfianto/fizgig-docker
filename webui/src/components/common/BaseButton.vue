<script setup lang="ts">
import { computed } from "vue";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "neutral"
  | "outline"
  | "warning"
  | "error";

export type ButtonSize =
  | "default" // 38.25px (h-8.5 rounded-lg) - Primary actions, modals, toolbar controls
  | "compact" // 33.75px (h-7.5 rounded-md) - List items, card CTAs, banner actions
  | "pill" // 33.75px (h-7.5 rounded-md) - Segmented pills inside BasePillGroup
  | "square-default" // 38.25px × 38.25px (h-8.5 w-8.5 rounded-lg) - Square icon button
  | "square-compact" // 33.75px × 33.75px (h-7.5 w-7.5 rounded-md) - Steppers, reorder, delete
  | "icon-xs"; // 24px × 24px (h-6 w-6 rounded) - Ultra-compact row icon button

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    active?: boolean;
    disabled?: boolean;
    loading?: boolean;
    type?: "button" | "submit" | "reset";
    title?: string;
  }>(),
  {
    variant: "ghost",
    size: "default",
    active: false,
    disabled: false,
    loading: false,
    type: "button",
    title: undefined,
  },
);

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const variantClasses = computed(() => {
  // Pill size has specialized active/inactive contrast inside segmented tracks
  if (props.size === "pill") {
    if (props.active) {
      if (props.variant === "warning") {
        return "bg-warning text-warning-content shadow-xs";
      }
      if (props.variant === "neutral") {
        return "bg-neutral text-neutral-content shadow-xs";
      }
      return "bg-primary text-primary-content shadow-xs";
    }
    return "btn-ghost text-subtle hover:text-base-content";
  }

  // Active state for non-pill buttons (e.g. toggles)
  if (props.active) {
    return "bg-primary text-primary-content shadow-xs";
  }

  switch (props.variant) {
    case "primary":
      return "btn-primary text-primary-content shadow-xs hover:brightness-105";
    case "secondary":
      return "btn-secondary text-secondary-content shadow-xs hover:brightness-105";
    case "neutral":
      return "btn-neutral text-base-content border border-hairline-strong";
    case "outline":
      return "btn-outline border-hairline-strong text-base-content hover:border-primary hover:text-primary";
    case "warning":
      return "border border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 shadow-xs";
    case "error":
      return "border border-error/40 bg-error/10 text-error hover:bg-error/20 shadow-xs";
    case "ghost":
    default:
      return "btn-ghost border border-hairline bg-base-200 text-subtle hover:text-base-content hover:border-primary/50";
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "default":
      return "btn-sm h-8.5 rounded-lg px-3 text-xs gap-1.5";
    case "compact":
      return "btn-sm h-7.5 rounded-md px-2.5 text-xs gap-1.5";
    case "pill":
      return "btn-sm h-7.5 join-item border-0 px-3.5 text-xs font-semibold rounded-md gap-1.5";
    case "square-default":
      return "btn-sm h-8.5 w-8.5 p-0 rounded-lg gap-0";
    case "square-compact":
      return "btn-sm h-7.5 w-7.5 p-0 rounded-md gap-0";
    case "icon-xs":
      return "btn-xs h-6 w-6 p-0 rounded gap-0 min-h-0";
    default:
      return "btn-sm h-8.5 rounded-lg px-3 text-xs gap-1.5";
  }
});
</script>

<template>
  <button
    :type="type"
    :title="title"
    :disabled="disabled || loading"
    class="btn transition inline-flex items-center justify-center font-sans font-semibold cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[sizeClasses, variantClasses]"
    @click="emit('click', $event)"
  >
    <slot name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </button>
</template>
