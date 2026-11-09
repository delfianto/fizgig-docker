<script setup lang="ts" generic="T extends string | number">
import { type Component } from "vue";
import BaseButton, { type ButtonVariant } from "./BaseButton.vue";

export interface PillOption<V extends string | number = string | number> {
  value: V;
  label?: string;
  icon?: Component;
  title?: string;
  variant?: ButtonVariant;
}

const props = defineProps<{
  modelValue?: T;
  options?: Array<PillOption<T>>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: T): void;
  (e: "change", value: T): void;
}>();

function selectOption(val: T): void {
  emit("update:modelValue", val);
  emit("change", val);
}
</script>

<template>
  <div
    class="join border border-hairline-strong bg-base-300 p-0.5 rounded-lg h-8.5 items-center inline-flex"
  >
    <slot>
      <template v-if="options && options.length > 0">
        <BaseButton
          v-for="opt in options"
          :key="String(opt.value)"
          size="pill"
          :active="modelValue === opt.value"
          :variant="opt.variant ?? 'ghost'"
          :title="opt.title"
          @click="selectOption(opt.value)"
        >
          <component :is="opt.icon" v-if="opt.icon" class="h-3.5 w-3.5" />
          <span v-if="opt.label">{{ opt.label }}</span>
        </BaseButton>
      </template>
    </slot>
  </div>
</template>
