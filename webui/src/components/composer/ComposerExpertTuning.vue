<script setup lang="ts">
import { computed, ref } from "vue";
import { Search } from "lucide-vue-next";
import { type SchemaRow } from "@shared/types";
import SchemaField from "@/components/schema/SchemaField.vue";
import { useComposerStore } from "@/stores/composer";

const composerStore = useComposerStore();

const expertTab = ref<keyof typeof EXPERT_GROUPS>("general");
const paramFilter = ref("");

const EXPERT_GROUPS = {
  general: {
    title: "General & Architecture",
    keys: [
      "LORA_NAME",
      "CAPTION_TRIGGER_WORD",
      "LORA_OUTPUT_DIR",
      "MAX_TRAIN_EPOCHS",
      "SAVE_EVERY_N_EPOCHS",
      "SEED",
      "RESUME_TRAINING",
    ],
  },
  network: {
    title: "Network & LoRA Rank",
    keys: [
      "NETWORK_DIM",
      "NETWORK_ALPHA",
      "CONV_DIM",
      "CONV_ALPHA",
      "NETWORK_DROPOUT",
      "SCALE_WEIGHT_NORMS",
      "FAMILY_DORA",
      "FAMILY_WEIGHT_DECOMPOSE",
    ],
  },
  optimizer: {
    title: "Optimizer & Schedule",
    keys: [
      "OPTIMIZER_TYPE",
      "LEARNING_RATE",
      "ADAPTIVE_LR",
      "UNET_LR",
      "TEXT_ENCODER_LR",
      "LR_SCHEDULER",
      "LR_WARMUP_STEPS",
      "OPTIMIZER_ARGS",
      "MAX_GRAD_NORM",
    ],
  },
  dataset: {
    title: "Dataset & Caching",
    keys: [
      "DATASET_MEGAPIXELS",
      "DATASET_BATCH_SIZE",
      "DATASET_CAPTION_EXT",
      "CACHE_LATENTS",
      "CACHE_TEXT_ENCODER_OUTPUTS",
      "COLOR_AUGMENTATION",
      "FLIP_AUGMENTATION",
      "NUM_WORKERS",
    ],
  },
  samples: {
    title: "Sample Prompts",
    keys: [
      "SAMPLE_PROMPT",
      "SAMPLE_EVERY_N_EPOCHS",
      "SAMPLE_WIDTH",
      "SAMPLE_HEIGHT",
      "SAMPLE_STEPS",
      "SAMPLE_CFG_SCALE",
      "SAMPLE_SEED",
      "FAMILY_TURBO_STRENGTH",
    ],
  },
  hardware: {
    title: "Hardware & Precision",
    keys: [
      "MIXED_PRECISION",
      "GRADIENT_CHECKPOINTING",
      "GRADIENT_ACCUMULATION_STEPS",
      "BLOCKS_SWAP",
      "XFORMERS",
      "SDPA",
    ],
  },
} as const;

function row(key: string): SchemaRow | null {
  const rows = composerStore.currentFamilyDesc?.form.rows ?? [];
  return rows.find((r) => r.key === key) ?? null;
}

function modifiedCountInTab(tabKey: keyof typeof EXPERT_GROUPS): number {
  const grp = EXPERT_GROUPS[tabKey];
  let count = 0;
  for (const k of grp.keys) {
    if (composerStore.modifiedKeys.has(k)) {
      count++;
    }
  }
  return count;
}

const currentGroupTitle = computed(() => EXPERT_GROUPS[expertTab.value].title);
const currentKeys = computed(() => EXPERT_GROUPS[expertTab.value].keys);
</script>

<template>
  <main class="flex-1 overflow-hidden grid grid-cols-[240px_1fr]">
    <!-- Expert Left Category Tabs -->
    <aside
      class="flex flex-col border-r border-hairline bg-base-200/50 p-2.5 space-y-1 overflow-y-auto"
    >
      <div class="mb-2 px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        Expert Parameters
      </div>

      <button
        v-for="(grp, tabKey) in EXPERT_GROUPS"
        :key="tabKey"
        type="button"
        class="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition cursor-pointer"
        :class="
          expertTab === tabKey
            ? 'bg-primary text-primary-content font-bold shadow'
            : 'text-subtle hover:bg-base-300'
        "
        @click="expertTab = tabKey"
      >
        <span class="truncate">{{ grp.title }}</span>
        <span
          v-if="modifiedCountInTab(tabKey) > 0"
          class="badge badge-xs font-mono"
          :class="expertTab === tabKey ? 'badge-warning' : 'badge-primary'"
        >
          {{ modifiedCountInTab(tabKey) }}
        </span>
      </button>
    </aside>

    <!-- Expert Main Parameter Form Panel -->
    <section class="flex flex-col overflow-hidden bg-base-100">
      <!-- Sub-header with Filter Search -->
      <div
        class="flex items-center justify-between border-b border-hairline bg-base-200/40 px-5 py-2.5"
      >
        <div>
          <h2 class="text-sm font-bold text-base-content">
            {{ currentGroupTitle }}
          </h2>
          <p class="text-xs text-muted">
            Fine-tune underlying hyperparameters while preserving recipe baseline defaults.
          </p>
        </div>

        <div class="relative w-64">
          <Search class="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
          <input
            v-model="paramFilter"
            type="text"
            placeholder="Search parameter key..."
            class="input input-xs input-bordered w-full bg-base-300/60 pl-8 text-xs font-mono"
          />
        </div>
      </div>

      <!-- Render Parameter Fields in Clean Grid -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl space-y-4">
          <div
            v-for="k in currentKeys"
            :key="k"
            class="rounded-lg border border-hairline bg-base-200/60 p-3.5 transition-colors hover:border-hairline-strong"
            :class="{
              hidden: paramFilter && !k.toLowerCase().includes(paramFilter.toLowerCase()),
            }"
          >
            <SchemaField v-if="row(k)" :row="row(k)!" />
            <div v-else class="flex items-center justify-between text-xs text-muted">
              <span class="font-mono">{{ k }}</span>
              <span class="badge badge-xs">Not applicable to {{ composerStore.family }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
