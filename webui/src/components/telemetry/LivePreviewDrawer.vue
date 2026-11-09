<script setup lang="ts">
import { ref, watch } from "vue";
import { AlertTriangle, RotateCcw, Sparkles, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { BaseButton, BaseInput } from "@/components/common";
import { useRunStore } from "@/stores/run";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const runStore = useRunStore();

const prompts = ref("");
const seed = ref("1234");
const width = ref("1024");
const height = ref("1024");
const steps = ref("8");
const cfg = ref("1.0");
const turbo = ref("0.7");
const every = ref("1");
const saving = ref(false);

// Always initialize from the ACTIVE RUN'S own values, never from draft Composer!
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && runStore.run?.values) {
      const v = runStore.run.values;
      prompts.value = String(v.SAMPLE_PROMPT ?? "");
      seed.value = String(v.SAMPLE_SEED ?? "1234");
      width.value = String(v.SAMPLE_WIDTH ?? "1024");
      height.value = String(v.SAMPLE_HEIGHT ?? "1024");
      steps.value = String(v.SAMPLE_STEPS ?? "8");
      cfg.value = String(v.SAMPLE_CFG_SCALE ?? "1.0");
      turbo.value = String(v.FAMILY_TURBO_STRENGTH ?? "0.7");
      every.value = String(v.SAMPLE_EVERY_N_EPOCHS ?? "1");
    }
  },
  { immediate: true },
);

async function handleApplyOverride(): Promise<void> {
  saving.value = true;
  try {
    await runStore.applyLiveSampleOverride({
      on: true,
      prompts: prompts.value,
      seed: seed.value,
      width: width.value,
      height: height.value,
      steps: steps.value,
      cfg: cfg.value,
      turbo: turbo.value,
      every: every.value,
    });
    toast.success("Live sample override written for next epoch boundary");
    emit("close");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to apply override");
  } finally {
    saving.value = false;
  }
}

async function handleClearOverride(): Promise<void> {
  saving.value = true;
  try {
    await runStore.applyLiveSampleOverride({
      on: false,
      prompts: "",
      seed: seed.value,
      width: width.value,
      height: height.value,
      steps: steps.value,
      cfg: cfg.value,
      turbo: turbo.value,
      every: every.value,
    });
    toast.success("Cleared .sample_override.json — active run restored to its launch prompts");
    emit("close");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to clear override");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    @click.self="emit('close')"
  >
    <div
      class="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-hairline-strong bg-base-300 shadow-2xl"
    >
      <!-- Drawer Header -->
      <div class="flex items-center justify-between border-b border-hairline bg-base-200 px-4 py-3">
        <div class="flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-primary" />
          <h3 class="text-sm font-semibold text-base-content">
            Live Run Preview Override ({{ runStore.run?.lora || "No active run" }})
          </h3>
        </div>
        <button type="button" class="btn btn-xs btn-ghost" @click="emit('close')">
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Drawer Body -->
      <div class="space-y-4 p-4 text-xs">
        <div
          class="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-subtle"
        >
          <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p class="font-medium text-base-content">Isolated from Composer Drafts</p>
            <p class="mt-0.5 text-[11px]">
              Unlike upstream Fizgig, changing presets or prompts in the Composer will
              <strong>never</strong> overwrite your running job. Changes made here are only written
              to
              <code class="font-mono text-base-content">.sample_override.json</code>
              when you explicitly click <strong>Apply Live Override</strong>.
            </p>
          </div>
        </div>

        <div>
          <label class="mb-1 block font-medium text-base-content">
            Sample Prompts (One prompt per line)
          </label>
          <textarea
            v-model="prompts"
            rows="5"
            class="textarea textarea-bordered w-full border-hairline-strong bg-base-100 font-mono text-xs leading-relaxed"
            placeholder="One sample prompt per line..."
          />
        </div>

        <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <div>
            <label class="mb-1 block text-[11px] text-subtle">Width</label>
            <BaseInput v-model="width" mono />
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-subtle">Height</label>
            <BaseInput v-model="height" mono />
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-subtle">Steps</label>
            <BaseInput v-model="steps" mono />
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-subtle">CFG</label>
            <BaseInput v-model="cfg" mono />
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-subtle">Seed</label>
            <BaseInput v-model="seed" mono />
          </div>
          <div>
            <label class="mb-1 block text-[11px] text-subtle"> Turbo Str </label>
            <BaseInput v-model="turbo" mono />
          </div>
        </div>
      </div>

      <!-- Drawer Footer -->
      <div class="flex items-center justify-between border-t border-hairline bg-base-200 px-4 py-3">
        <BaseButton
          variant="warning"
          :disabled="saving || !runStore.isRunning"
          @click="handleClearOverride"
        >
          <template #icon-left><RotateCcw class="h-3.5 w-3.5" /></template>
          <span>Clear Override &amp; Restore Launch Prompts</span>
        </BaseButton>

        <div class="flex items-center gap-2">
          <BaseButton variant="ghost" @click="emit('close')">
            <span>Cancel</span>
          </BaseButton>
          <BaseButton
            variant="primary"
            :disabled="saving || !runStore.isRunning"
            @click="handleApplyOverride"
          >
            <span>Apply Live Override</span>
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
