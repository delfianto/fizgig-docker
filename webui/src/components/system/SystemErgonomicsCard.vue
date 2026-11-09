<script setup lang="ts">
import { Sliders } from "lucide-vue-next";
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
        <div class="join border border-base-300">
          <button
            type="button"
            class="btn btn-xs join-item cursor-pointer"
            :class="systemStore.fontScale === 'normal' ? 'btn-primary' : 'btn-ghost'"
            @click="systemStore.setFontScale('normal')"
          >
            Normal (16px)
          </button>
          <button
            type="button"
            class="btn btn-xs join-item cursor-pointer"
            :class="systemStore.fontScale === 'large' ? 'btn-primary' : 'btn-ghost'"
            @click="systemStore.setFontScale('large')"
          >
            Large (18px)
          </button>
          <button
            type="button"
            class="btn btn-xs join-item cursor-pointer"
            :class="systemStore.fontScale === 'xlarge' ? 'btn-primary' : 'btn-ghost'"
            @click="systemStore.setFontScale('xlarge')"
          >
            XL (20px)
          </button>
        </div>

        <div class="join">
          <button
            type="button"
            class="btn btn-xs join-item cursor-pointer"
            :class="
              systemStore.density === 'default' ? 'btn-primary' : 'btn-ghost border border-base-300'
            "
            @click="systemStore.density = 'default'"
          >
            Standard (34px)
          </button>
          <button
            type="button"
            class="btn btn-xs join-item cursor-pointer"
            :class="
              systemStore.density === 'compact' ? 'btn-primary' : 'btn-ghost border border-base-300'
            "
            @click="systemStore.density = 'compact'"
          >
            Compact (28px)
          </button>
        </div>

        <label
          class="flex cursor-pointer items-center gap-2 rounded border border-base-300 bg-base-300/50 px-3 py-1.5 text-xs select-none"
        >
          <input
            v-model="systemStore.explainMode"
            type="checkbox"
            class="toggle toggle-xs toggle-primary"
          />
          <span>Show Explain Prose</span>
        </label>
      </div>
    </div>
  </section>
</template>
