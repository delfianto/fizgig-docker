<script setup lang="ts">
import { computed } from "vue";
import { Clock } from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";

const emit = defineEmits<{
  (e: "set-quick-epochs", epochs: number): void;
}>();

const composerStore = useComposerStore();

const currentEpochs = computed(() => {
  return Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30);
});

const epochTicks = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
</script>

<template>
  <section class="rounded-xl border border-hairline bg-base-300/80 p-2.5 space-y-1.5">
    <div class="flex items-center justify-between border-b border-hairline pb-1">
      <div class="flex items-center gap-2">
        <Clock class="h-3.5 w-3.5 text-warning" />
        <h2 class="text-xs font-bold uppercase tracking-wider text-base-content">
          Training Schedule
        </h2>
      </div>
      <span class="font-mono text-[11px] text-muted">
        Saves every {{ composerStore.draftValues.SAVE_EVERY_N_EPOCHS ?? 1 }} epoch(s)
      </span>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between">
        <label class="text-xs font-semibold text-subtle"> Total Epochs: </label>
        <div class="flex items-center gap-1.5">
          <button
            v-for="ep in [15, 30, 50, 75]"
            :key="ep"
            type="button"
            class="btn btn-xs h-5 min-h-0 px-2 text-[10px]"
            :class="currentEpochs === ep ? 'btn-primary' : 'btn-ghost border border-hairline'"
            @click="emit('set-quick-epochs', ep)"
          >
            {{ ep }}
          </button>
          <input
            :value="currentEpochs"
            type="number"
            min="1"
            max="300"
            class="input input-xs w-14 border-hairline-strong bg-base-100 font-mono text-center font-bold text-base-content h-5 text-[11px]"
            @input="
              composerStore.setFieldValue(
                'MAX_TRAIN_EPOCHS',
                Math.max(1, Number(($event.target as HTMLInputElement).value)),
              )
            "
          />
        </div>
      </div>

      <!-- Slider with Ticks / Markers per 10 -->
      <div class="space-y-1">
        <input
          :value="Math.min(100, Math.max(10, currentEpochs))"
          type="range"
          min="10"
          max="100"
          step="1"
          class="range range-xs range-primary w-full cursor-pointer"
          @input="
            composerStore.setFieldValue(
              'MAX_TRAIN_EPOCHS',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />

        <!-- Ruler Ticks & Number Labels per 10 (10 to 100) -->
        <div class="flex w-full justify-between px-1.5 text-mono select-none">
          <button
            v-for="tick in epochTicks"
            :key="tick"
            type="button"
            class="flex flex-col items-center group cursor-pointer border-none bg-transparent p-0 transition"
            :class="
              Math.abs(currentEpochs - tick) <= 4
                ? 'text-primary font-bold'
                : 'text-muted hover:text-base-content'
            "
            :title="`Set to ${tick} epochs`"
            @click="composerStore.setFieldValue('MAX_TRAIN_EPOCHS', tick)"
          >
            <span
              class="h-2 w-0.5 rounded-full transition-colors"
              :class="
                Math.abs(currentEpochs - tick) <= 4
                  ? 'bg-primary'
                  : 'bg-base-content/25 group-hover:bg-base-content/50'
              "
            />
            <span class="text-[10px] mt-0.5 leading-none font-mono">{{ tick }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
