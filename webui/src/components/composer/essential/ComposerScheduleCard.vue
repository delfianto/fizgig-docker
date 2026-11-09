<script setup lang="ts">
import { Clock } from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";

const emit = defineEmits<{
  (e: "set-quick-epochs", epochs: number): void;
}>();

const composerStore = useComposerStore();
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

    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <label class="text-xs font-semibold text-subtle"> Total Epochs: </label>
        <div class="flex items-center gap-1.5">
          <button
            v-for="ep in [15, 30, 50, 75]"
            :key="ep"
            type="button"
            class="btn btn-xs h-5 min-h-0 px-2 text-[10px]"
            :class="
              Number(composerStore.draftValues.MAX_TRAIN_EPOCHS) === ep
                ? 'btn-primary'
                : 'btn-ghost border border-hairline'
            "
            @click="emit('set-quick-epochs', ep)"
          >
            {{ ep }}
          </button>
          <input
            :value="Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30)"
            type="number"
            min="1"
            max="300"
            class="input input-xs w-14 border-hairline-strong bg-base-100 font-mono text-center font-bold text-base-content h-5 text-[11px]"
            @input="
              composerStore.setFieldValue(
                'MAX_TRAIN_EPOCHS',
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
      </div>

      <input
        :value="Number(composerStore.draftValues.MAX_TRAIN_EPOCHS ?? 30)"
        type="range"
        min="5"
        max="100"
        step="1"
        class="range range-xs range-primary w-full"
        @input="
          composerStore.setFieldValue(
            'MAX_TRAIN_EPOCHS',
            Number(($event.target as HTMLInputElement).value),
          )
        "
      />
    </div>
  </section>
</template>
