<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    padded?: boolean;
    elevated?: boolean;
  }>(),
  {
    title: undefined,
    subtitle: undefined,
    padded: true,
    elevated: false,
  },
);
</script>

<template>
  <section
    class="rounded-xl border border-hairline"
    :class="[elevated ? 'bg-base-300' : 'bg-base-200/80', padded ? 'p-4 sm:p-5' : '']"
  >
    <div
      v-if="title || $slots.header || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-3"
      :class="
        padded ? 'mb-3.5 border-b border-hairline pb-3' : 'border-b border-hairline px-4 py-3'
      "
    >
      <slot name="header">
        <div class="flex items-center gap-2.5 min-w-0">
          <slot name="icon" />
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-base-content truncate">{{ title }}</h2>
            <p v-if="subtitle" class="text-xs text-muted">{{ subtitle }}</p>
          </div>
        </div>
      </slot>
      <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </section>
</template>
