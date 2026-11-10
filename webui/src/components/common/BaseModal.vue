<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { X } from "lucide-vue-next";
import BaseButton from "./BaseButton.vue";

export type ModalMaxWidth = "sm" | "md" | "lg" | "2xl" | "5xl";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    subtitle?: string;
    maxWidth?: ModalMaxWidth;
    preventClose?: boolean;
    hideCloseButton?: boolean;
    bodyClass?: string;
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    maxWidth: "lg",
    preventClose: false,
    hideCloseButton: false,
    bodyClass: "p-4",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const widthClass = computed(() => {
  switch (props.maxWidth) {
    case "sm":
      return "max-w-sm";
    case "md":
      return "max-w-md";
    case "2xl":
      return "max-w-2xl";
    case "5xl":
      return "max-w-5xl";
    case "lg":
    default:
      return "max-w-lg";
  }
});

function requestClose(): void {
  if (!props.preventClose) {
    emit("close");
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && props.open && !props.preventClose) {
    event.stopPropagation();
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        @click.self="requestClose"
      >
        <div
          class="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl border border-hairline-strong bg-base-300 text-base-content"
          :class="widthClass"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header"
            class="flex shrink-0 items-center justify-between gap-3 border-b border-hairline bg-base-200 px-4 py-3"
          >
            <slot name="header">
              <div class="flex items-center gap-2.5 min-w-0">
                <slot name="icon" />
                <div class="min-w-0">
                  <h3 class="text-sm font-bold text-base-content truncate">{{ title }}</h3>
                  <p v-if="subtitle" class="text-xs text-muted truncate">{{ subtitle }}</p>
                </div>
              </div>
            </slot>

            <BaseButton
              v-if="!hideCloseButton"
              variant="bare"
              size="icon-xs"
              class="text-muted hover:text-base-content rounded-md shrink-0"
              :disabled="preventClose"
              title="Close (Esc)"
              @click="requestClose"
            >
              <X class="h-4 w-4" />
            </BaseButton>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto" :class="bodyClass">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="flex shrink-0 items-center justify-between gap-2 border-t border-hairline bg-base-200 px-4 py-3"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
