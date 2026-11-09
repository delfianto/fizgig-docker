<script setup lang="ts">
import { ListPlus, Play, RotateCcw, ShieldCheck, Sliders, Sparkles } from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";

withDefaults(
  defineProps<{
    mode: "essential" | "expert";
    canProcess?: boolean;
  }>(),
  {
    canProcess: true,
  },
);

const emit = defineEmits<{
  (e: "update:mode", mode: "essential" | "expert"): void;
  (e: "validate-plan"): void;
  (e: "queue-run"): void;
  (e: "start-run"): void;
}>();

const schemaStore = useSchemaStore();
const composerStore = useComposerStore();
const runStore = useRunStore();
</script>

<template>
  <header
    class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-base-200 px-4 py-2.5"
  >
    <!-- Left: Model Family & Recipe Preset -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-muted"> Model </span>
        <select
          :value="composerStore.family"
          class="select select-sm h-8.5 rounded-lg border-hairline-strong bg-base-300 text-xs font-semibold text-base-content min-w-44 focus:border-primary focus:outline-none"
          @change="composerStore.selectFamily(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="fam in schemaStore.families" :key="fam.key" :value="fam.key">
            {{ fam.gui_label || fam.display_name }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-muted"> Recipe </span>
        <select
          :value="composerStore.presetName"
          class="select select-sm h-8.5 rounded-lg border-hairline-strong bg-base-300 text-xs text-base-content w-80 lg:w-105 focus:border-primary focus:outline-none"
          @change="composerStore.applyPreset(($event.target as HTMLSelectElement).value)"
        >
          <optgroup label="Curated Recipes">
            <option
              v-for="p in composerStore.currentFamilyDesc?.form.presets ?? []"
              :key="p.name"
              :value="p.name"
            >
              {{ p.name }}
            </option>
          </optgroup>
          <optgroup v-if="composerStore.userPresets.length > 0" label="User Presets">
            <option v-for="up in composerStore.userPresets" :key="up" :value="up">
              {{ up }}
            </option>
          </optgroup>
        </select>

        <!-- Reset modified badge -->
        <button
          v-if="composerStore.modifiedKeys.size > 0"
          type="button"
          class="btn btn-sm h-8.5 rounded-lg border border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-content text-xs font-semibold px-2.5 gap-1.5 transition cursor-pointer"
          title="Reset all customized parameters back to recipe defaults"
          @click="composerStore.resetAllToPreset()"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          <span>Reset ({{ composerStore.modifiedKeys.size }} modified)</span>
        </button>
      </div>
    </div>

    <!-- Center: Progressive Disclosure Mode Switcher -->
    <div class="join border border-hairline-strong bg-base-300 p-0.5 rounded-lg h-8.5 items-center">
      <button
        type="button"
        class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3.5 text-xs font-semibold rounded-md transition cursor-pointer"
        :class="
          mode === 'essential'
            ? 'bg-primary text-primary-content font-bold shadow-xs'
            : 'btn-ghost text-subtle hover:bg-base-200'
        "
        @click="emit('update:mode', 'essential')"
      >
        <Sparkles class="h-3.5 w-3.5" />
        <span>Essential Studio</span>
      </button>
      <button
        type="button"
        class="btn btn-sm h-7.5 join-item border-0 gap-1.5 px-3.5 text-xs font-semibold rounded-md transition cursor-pointer"
        :class="
          mode === 'expert'
            ? 'bg-primary text-primary-content font-bold shadow-xs'
            : 'btn-ghost text-subtle hover:bg-base-200'
        "
        @click="emit('update:mode', 'expert')"
      >
        <Sliders class="h-3.5 w-3.5" />
        <span>Expert Tuning</span>
        <span
          v-if="composerStore.modifiedKeys.size > 0"
          class="badge badge-xs badge-warning font-mono ml-0.5"
        >
          {{ composerStore.modifiedKeys.size }}
        </span>
      </button>
    </div>

    <!-- Right: Preflight & Launch Buttons (Uniform cohesive button set) -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn btn-sm h-8.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold gap-1.5 transition shadow-xs cursor-pointer"
        :disabled="composerStore.validatingPlan"
        @click="emit('validate-plan')"
      >
        <ShieldCheck class="h-4 w-4 shrink-0" />
        <span>Check Plan</span>
      </button>

      <button
        type="button"
        class="btn btn-sm h-8.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold gap-1.5 transition shadow-xs cursor-pointer"
        :class="{ 'btn-primary text-primary-content': runStore.isActiveOrStarting && canProcess }"
        :disabled="!canProcess"
        :title="
          !canProcess
            ? 'Selected dataset is not completely tagged — captions required for all images'
            : 'Add this training configuration to the background queue'
        "
        @click="emit('queue-run')"
      >
        <ListPlus class="h-4 w-4 shrink-0" />
        <span>Add to Queue</span>
      </button>

      <button
        type="button"
        class="btn btn-sm h-8.5 rounded-lg btn-primary text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
        :disabled="!canProcess || runStore.isActiveOrStarting"
        :title="
          !canProcess
            ? 'Selected dataset is not completely tagged — captions required for all images'
            : runStore.isActiveOrStarting
              ? 'A training run is currently active on the GPU — use Add to Queue instead'
              : 'Validate and start training now'
        "
        @click="emit('start-run')"
      >
        <Play class="h-4 w-4 fill-current shrink-0" />
        <span>Start Training</span>
      </button>
    </div>
  </header>
</template>
