<script setup lang="ts">
import { ListPlus, Play, RotateCcw, ShieldCheck, Sliders, Sparkles } from "lucide-vue-next";
import BaseButton from "@/components/common/BaseButton.vue";
import BasePillGroup from "@/components/common/BasePillGroup.vue";
import BaseSelect from "@/components/common/BaseSelect.vue";
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
        <BaseSelect
          :model-value="composerStore.family"
          class="min-w-44 font-semibold"
          @update:model-value="composerStore.selectFamily(String($event))"
        >
          <option v-for="fam in schemaStore.families" :key="fam.key" :value="fam.key">
            {{ fam.gui_label || fam.display_name }}
          </option>
        </BaseSelect>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-muted"> Recipe </span>
        <BaseSelect
          :model-value="composerStore.presetName"
          class="w-80 lg:w-105"
          @update:model-value="composerStore.applyPreset(String($event))"
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
        </BaseSelect>

        <!-- Reset modified badge -->
        <BaseButton
          v-if="composerStore.modifiedKeys.size > 0"
          variant="outline"
          class="border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-content"
          title="Reset all customized parameters back to recipe defaults"
          @click="composerStore.resetAllToPreset()"
        >
          <template #icon-left><RotateCcw class="h-3.5 w-3.5" /></template>
          <span>Reset ({{ composerStore.modifiedKeys.size }} modified)</span>
        </BaseButton>
      </div>
    </div>

    <!-- Center: Progressive Disclosure Mode Switcher -->
    <BasePillGroup>
      <button
        type="button"
        class="btn btn-sm h-7.5 border-0 gap-1.5 px-3.5 text-xs font-semibold rounded-md transition cursor-pointer"
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
        class="btn btn-sm h-7.5 border-0 gap-1.5 px-3.5 text-xs font-semibold rounded-md transition cursor-pointer"
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
    </BasePillGroup>

    <!-- Right: Preflight & Launch Buttons (Uniform cohesive button set) -->
    <div class="flex items-center gap-2">
      <BaseButton
        variant="outline"
        class="border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-bold shadow-xs"
        :disabled="composerStore.validatingPlan"
        @click="emit('validate-plan')"
      >
        <template #icon-left><ShieldCheck class="h-4 w-4 shrink-0" /></template>
        <span>Check Plan</span>
      </BaseButton>

      <BaseButton
        :variant="runStore.isActiveOrStarting && canProcess ? 'primary' : 'outline'"
        class="border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-bold shadow-xs"
        :class="{ 'text-primary-content': runStore.isActiveOrStarting && canProcess }"
        :disabled="!canProcess"
        :title="
          !canProcess
            ? 'Selected dataset is not completely tagged — captions required for all images'
            : 'Add this training configuration to the background queue'
        "
        @click="emit('queue-run')"
      >
        <template #icon-left><ListPlus class="h-4 w-4 shrink-0" /></template>
        <span>Add to Queue</span>
      </BaseButton>

      <BaseButton
        variant="primary"
        class="font-bold shadow-sm"
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
        <template #icon-left><Play class="h-4 w-4 fill-current shrink-0" /></template>
        <span>Start Training</span>
      </BaseButton>
    </div>
  </header>
</template>
