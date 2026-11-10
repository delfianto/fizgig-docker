<script setup lang="ts">
import { computed } from "vue";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "outline";

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant;
    size?: "xs" | "sm";
    mono?: boolean;
  }>(),
  {
    variant: "neutral",
    size: "xs",
    mono: false,
  },
);

const variantClass = computed(() => {
  switch (props.variant) {
    case "primary":
      return "border-primary/30 bg-primary/15 text-primary";
    case "success":
      return "border-success/30 bg-success/15 text-success";
    case "warning":
      return "border-warning/30 bg-warning/15 text-warning";
    case "error":
      return "border-error/30 bg-error/15 text-error";
    case "info":
      return "border-info/30 bg-info/15 text-info";
    case "outline":
      return "border-hairline-strong bg-transparent text-subtle";
    case "neutral":
    default:
      return "border-hairline bg-base-300 text-subtle";
  }
});

const sizeClass = computed(() => {
  return props.size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded border font-semibold leading-none shrink-0"
    :class="[variantClass, sizeClass, mono ? 'font-mono' : 'font-sans']"
  >
    <slot />
  </span>
</template>
