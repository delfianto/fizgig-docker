<script setup lang="ts">
import { Sliders } from "lucide-vue-next";
import { BasePillGroup, BaseToggle } from "@/components/common";
import { useSystemStore } from "@/stores/system";

const systemStore = useSystemStore();
</script>

<template>
  <section class="rounded-lg border border-base-300 bg-base-200/80 p-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2.5">
        <Sliders class="h-4 w-4 text-primary" />
        <div>
          <h2 class="text-sm font-semibold text-base-content">
            UI Density &amp; Pedagogical Prose Mode
          </h2>
          <p class="text-xs text-base-content/60">
            Customize control spacing and whether upstream Fizgig's verbose tutorial prose blocks
            are shown inline.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Font Scale Selector -->
        <BasePillGroup
          :model-value="systemStore.fontScale"
          :options="[
            { value: 'normal', label: 'Normal (16px)' },
            { value: 'large', label: 'Large (18px)' },
            { value: 'xlarge', label: 'XL (20px)' },
          ]"
          @update:model-value="
            (val) => systemStore.setFontScale(val as 'normal' | 'large' | 'xlarge')
          "
        />

        <BasePillGroup
          :model-value="systemStore.density"
          :options="[
            { value: 'default', label: 'Standard (34px)' },
            { value: 'compact', label: 'Compact (28px)' },
          ]"
          @update:model-value="(val) => (systemStore.density = val as 'default' | 'compact')"
        />

        <div
          class="flex h-8.5 items-center gap-2 rounded-lg border border-hairline bg-base-300/50 px-3 text-xs select-none hover:border-primary/40 transition"
        >
          <BaseToggle v-model="systemStore.explainMode" size="compact" label="Show Explain Prose" />
        </div>
      </div>
    </div>
  </section>
</template>
