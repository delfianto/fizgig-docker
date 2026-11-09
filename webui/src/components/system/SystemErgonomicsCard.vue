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
        <div
          class="join border border-hairline-strong bg-base-300 p-0.5 rounded-lg h-8.5 items-center"
        >
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              systemStore.fontScale === 'normal'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="systemStore.setFontScale('normal')"
          >
            Normal (16px)
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              systemStore.fontScale === 'large'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="systemStore.setFontScale('large')"
          >
            Large (18px)
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              systemStore.fontScale === 'xlarge'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="systemStore.setFontScale('xlarge')"
          >
            XL (20px)
          </button>
        </div>

        <div
          class="join border border-hairline-strong bg-base-300 p-0.5 rounded-lg h-8.5 items-center"
        >
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              systemStore.density === 'default'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="systemStore.density = 'default'"
          >
            Standard (34px)
          </button>
          <button
            type="button"
            class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3 text-xs font-semibold rounded-md transition cursor-pointer"
            :class="
              systemStore.density === 'compact'
                ? 'bg-primary text-primary-content shadow-xs'
                : 'btn-ghost text-subtle hover:text-base-content'
            "
            @click="systemStore.density = 'compact'"
          >
            Compact (28px)
          </button>
        </div>

        <label
          class="flex h-8.5 cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-base-300/50 px-3 text-xs select-none hover:border-primary/40 transition"
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
