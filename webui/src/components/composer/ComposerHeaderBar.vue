<script setup lang="ts">
import { ListPlus, Play, RotateCcw, ShieldCheck, Sliders, Sparkles } from "lucide-vue-next";
import { useComposerStore } from "@/stores/composer";
import { useRunStore } from "@/stores/run";
import { useSchemaStore } from "@/stores/schema";

defineProps<{
  mode: "essential" | "expert";
}>();

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
          class="select select-sm border-hairline-strong bg-base-300 text-xs font-semibold text-base-content min-w-44"
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
          class="select select-sm border-hairline-strong bg-base-300 text-xs text-base-content w-80 lg:w-105"
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
          class="btn btn-xs border border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-content"
          title="Reset all customized parameters back to recipe defaults"
          @click="composerStore.resetAllToPreset()"
        >
          <RotateCcw class="h-3 w-3" />
          Reset ({{ composerStore.modifiedKeys.size }} modified)
        </button>
      </div>
    </div>

    <!-- Center: Progressive Disclosure Mode Switcher -->
    <div class="join border border-hairline-strong bg-base-300 p-0.5 rounded-md">
      <button
        type="button"
        class="btn btn-xs join-item border-0 gap-1.5 px-3"
        :class="
          mode === 'essential'
            ? 'bg-primary text-primary-content font-bold'
            : 'btn-ghost text-subtle'
        "
        @click="emit('update:mode', 'essential')"
      >
        <Sparkles class="h-3.5 w-3.5" />
        <span>Essential Studio</span>
      </button>
      <button
        type="button"
        class="btn btn-xs join-item border-0 gap-1.5 px-3"
        :class="
          mode === 'expert' ? 'bg-primary text-primary-content font-bold' : 'btn-ghost text-subtle'
        "
        @click="emit('update:mode', 'expert')"
      >
        <Sliders class="h-3.5 w-3.5" />
        <span>Expert Tuning</span>
        <span
          v-if="composerStore.modifiedKeys.size > 0"
          class="badge badge-xs badge-warning font-mono"
        >
          {{ composerStore.modifiedKeys.size }}
        </span>
      </button>
    </div>

    <!-- Right: Preflight & Launch Buttons -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn btn-sm btn-ghost border border-hairline-strong bg-base-300 text-xs gap-1.5"
        :disabled="composerStore.validatingPlan"
        @click="emit('validate-plan')"
      >
        <ShieldCheck class="h-4 w-4 text-info" />
        <span>Check Plan</span>
      </button>

      <button
        type="button"
        class="btn btn-sm border border-hairline-strong bg-base-300 text-xs hover:border-primary gap-1.5"
        :class="{ 'btn-primary': runStore.isActiveOrStarting }"
        @click="emit('queue-run')"
      >
        <ListPlus class="h-4 w-4" />
        <span>Add to Queue</span>
      </button>

      <button
        type="button"
        class="btn btn-sm btn-primary text-xs gap-1.5 font-bold"
        :disabled="runStore.isActiveOrStarting"
        :title="
          runStore.isActiveOrStarting
            ? 'A training run is currently active on the GPU — use Add to Queue instead'
            : 'Validate and start training now'
        "
        @click="emit('start-run')"
      >
        <Play class="h-4 w-4 fill-current" />
        <span>Start Training</span>
      </button>
    </div>
  </header>
</template>
